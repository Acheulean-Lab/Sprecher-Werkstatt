// Self-test for the impulse-response SNR detector.
//
// Run from the browser console (DEV builds only) with:  __snrSelfTest()
//
// Validates two scenarios end-to-end through the pipeline:
//   1. Real measurement: synthetic sweep convolved with a synthetic IR + noise.
//      Expected: SNR ≥ 25 dB (a real, quiet-room measurement should comfortably
//      land in the green zone).
//   2. Pure noise:        recording = white noise only, no sweep.
//      Expected: SNR < 10 dB (red — flagged as invalid).
import { generateLogSweep } from './sweepGenerator';
import { processMeasurement } from './pipeline';

function whiteNoise(n: number, amp = 0.01): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (Math.random() * 2 - 1) * amp;
  return out;
}

function syntheticSpeakerIR(sampleRate: number, lengthMs = 30): Float32Array {
  const n = Math.round((lengthMs / 1000) * sampleRate);
  const out = new Float32Array(n);
  // Direct impulse + a couple of weak reflections to look speaker-ish.
  out[8] = 1.0;
  out[Math.round(0.003 * sampleRate)] = 0.3;
  out[Math.round(0.008 * sampleRate)] = 0.15;
  out[Math.round(0.015 * sampleRate)] = -0.1;
  return out;
}

function convolve(a: Float32Array, b: Float32Array): Float32Array {
  const n = a.length + b.length - 1;
  const out = new Float32Array(n);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) continue;
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

export interface SnrSelfTestResult {
  realSnrDb: number;
  noiseSnrDb: number;
  passed: boolean;
}

export function snrSelfTest(): SnrSelfTestResult {
  const sr = 48000;
  const sweep = generateLogSweep(20, 20000, 5, sr);

  // 1. REAL measurement
  const ir = syntheticSpeakerIR(sr);
  const cleanRecording = convolve(sweep.samples, ir);
  const noise = whiteNoise(cleanRecording.length, 0.005);
  const recording = new Float32Array(cleanRecording.length);
  for (let i = 0; i < recording.length; i++) recording[i] = cleanRecording[i] + noise[i];
  const realResult = processMeasurement(recording, sweep, sr, 5, null);

  // 2. NOISE-ONLY
  const noiseOnly = whiteNoise(sweep.samples.length + 1024, 0.05);
  const noiseResult = processMeasurement(noiseOnly, sweep, sr, 5, null);

  const realSnrDb = realResult.metrics.snrDb;
  const noiseSnrDb = noiseResult.metrics.snrDb;

  const passed = realSnrDb >= 25 && noiseSnrDb < 10;

  // Log a colourful summary so it stands out in the console.
  const ok = (v: boolean) => v ? '✅' : '❌';
  console.group('SoundBench · SNR self-test');
  console.log(`${ok(realSnrDb >= 25)}  Real measurement (sweep + IR + noise) → ${realSnrDb.toFixed(1)} dB  (expect ≥ 25)`);
  console.log(`${ok(noiseSnrDb < 10)}  Pure noise (no sweep)                  → ${noiseSnrDb.toFixed(1)} dB  (expect < 10)`);
  console.log(passed ? '🟢 SNR detector PASSED' : '🔴 SNR detector FAILED — see numbers above');
  console.groupEnd();

  return { realSnrDb, noiseSnrDb, passed };
}

// Expose globally in dev for quick manual checks.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as unknown as { __snrSelfTest?: typeof snrSelfTest }).__snrSelfTest = snrSelfTest;
}
