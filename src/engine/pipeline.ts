// Glue: recording + sweep -> raw FR + smoothed FR + gated IR + ungated IR + metrics
import type { Sweep } from './sweepGenerator';
import { deconvolve, findImpulsePeak } from './deconvolution';
import { applyGatedWindow } from './windowing';
import { computeFR, fractionalOctaveSmooth, decimateLog, normalizeToReference, keyMetrics } from './frequencyResponse';
import { applyMicCorrection } from './micCalibration';
import { analyzeNoiseFloor } from './noiseFloor';
import type { MicProfile } from '../types';

export interface ProcessResult {
  raw: { f: number; db: number }[];
  smoothed: { f: number; db: number }[];
  impulseResponse: number[];
  fullImpulseResponse: number[];
  peakIndex: number;
  metrics: ReturnType<typeof keyMetrics> & { snrDb: number; irPeak: number };
}

// Compute the impulse-response signal-to-noise ratio using *energy concentration*.
//
// A real measurement: most energy is packed into a short window around the peak
// (the early part of the room/speaker IR). The pre-impulse region is silent.
// → energy_signal / energy_noise = 30–60+ dB.
//
// Deconvolved pure noise: energy is spread uniformly across the entire IR,
// so equivalent-length windows have similar energy regardless of position.
// → energy_signal / energy_noise ≈ 0–6 dB.
//
// Peak-vs-RMS does *not* discriminate well because:
//  · random noise over N samples has a natural ~14 dB peak factor;
//  · colored ambient noise (engine rumble, HVAC) gets amplified by the inverse
//    filter's +3 dB/oct tilt and produces transient-looking artefacts.
// Energy concentration is invariant to those things.
export function impulseSNR(ir: Float64Array, peakIdx: number, sampleRate: number): { snrDb: number; peak: number; noiseRms: number; concentration: number } {
  const sigWin = Math.max(64, Math.round(0.005 * sampleRate)); // 5 ms

  // Signal window: starts a few samples before the peak to capture full lobe energy.
  const sigStart = Math.max(0, peakIdx - 4);
  const sigEnd = Math.min(ir.length, sigStart + sigWin);
  let sigE = 0;
  for (let i = sigStart; i < sigEnd; i++) sigE += ir[i] * ir[i];
  const sigDensity = sigE / Math.max(1, sigEnd - sigStart);

  // Noise estimate: average energy density across the entire pre-impulse region,
  // skipping (a) the first 10% of the IR where FFT wraparound artefacts can sit,
  // and (b) the 10 ms immediately before the peak (pre-ringing from windowing).
  // Averaging over a long region collapses single-window variance, so a real
  // measurement in any quiet room yields a stable, very-low noise estimate
  // and an SNR well into the 30–80 dB range.
  const skipHead = Math.floor(ir.length * 0.10);
  const guard = Math.round(0.01 * sampleRate);
  const noiseStart = Math.min(skipHead, Math.max(0, peakIdx - guard - sigWin));
  const noiseEnd = Math.max(noiseStart + 1, peakIdx - guard);
  let noiseE = 0;
  let noiseN = 0;
  for (let i = noiseStart; i < noiseEnd; i++) { noiseE += ir[i] * ir[i]; noiseN++; }
  // Floor the noise density at machine-epsilon scale so a perfectly silent
  // pre-region (e.g. synthetic data) gives a high — but finite — SNR.
  const noiseDensity = Math.max(noiseE / Math.max(noiseN, 1), 1e-24);

  const concentration = sigDensity / noiseDensity;
  const snrDb = 10 * Math.log10(Math.max(concentration, 1e-12));

  const peak = Math.abs(ir[peakIdx]) || 1e-12;
  const noiseRms = Math.sqrt(noiseDensity);

  return { snrDb, peak, noiseRms, concentration };
}

export function processMeasurement(
  recording: Float32Array,
  sweep: Sweep,
  sampleRate: number,
  gateMs: number,
  micProfile: MicProfile | null
): ProcessResult {
  const ir = deconvolve(recording, sweep);
  const sweepSamples = sweep.samples.length;
  const peak = findImpulsePeak(
    ir,
    Math.max(0, sweepSamples - Math.round(0.05 * sampleRate)),
    sweepSamples + Math.round(0.05 * sampleRate)
  );

  // Gated IR for FR
  const gateSamples = Math.round((gateMs / 1000) * sampleRate);
  const windowed = applyGatedWindow(ir, peak, gateSamples, 8);

  // Ungated IR for waterfall — capture ~250 ms past the peak.
  // A full second is overkill for CSD (most cabinet/port resonances decay
  // within 100–200 ms) and 1 s × 48 kHz × ~17 chars/float in JSON ≈ 800 KB
  // per measurement, which fills localStorage quota after a handful of saves
  // and silently aborts the save handler.
  const fullStart = Math.max(0, peak - 16);
  const fullEnd = Math.min(ir.length, peak + Math.round(sampleRate * 0.25));
  const fullIR = Array.from(ir.slice(fullStart, fullEnd));

  // Raw FR and smoothed FR — both with mic correction + level normalization.
  const rawFR = computeFR(windowed, sampleRate);
  const rawCorrected = normalizeToReference(applyMicCorrection(rawFR, micProfile), 1000);
  const rawDecimated = decimateLog(rawCorrected, 256);

  let smoothed = fractionalOctaveSmooth(rawFR, 24);
  smoothed = applyMicCorrection(smoothed, micProfile);
  smoothed = normalizeToReference(smoothed, 1000);
  smoothed = decimateLog(smoothed, 96);

  const baseMetrics = keyMetrics(smoothed);
  const { snrDb, peak: irPeak } = impulseSNR(ir, peak, sampleRate);
  const metrics = { ...baseMetrics, snrDb, irPeak };

  // Short IR snippet (around peak) for impulse-response display.
  const irSnippetStart = Math.max(0, peak - 16);
  const irSnippetEnd = Math.min(ir.length, irSnippetStart + 1024);
  const irSnippet = Array.from(ir.slice(irSnippetStart, irSnippetEnd));

  return {
    raw: rawDecimated,
    smoothed,
    impulseResponse: irSnippet,
    fullImpulseResponse: fullIR,
    peakIndex: peak - irSnippetStart,
    metrics,
  };
}

// Re-export for backwards compatibility with old callers.
export function computeNoiseFloor(recording: Float32Array, sampleRate: number) {
  return analyzeNoiseFloor(recording, sampleRate).spectrum;
}
