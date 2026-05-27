// Ambient noise floor analysis. Computes a coarsely-smoothed magnitude spectrum
// of a silent recording so the wizard can warn about HVAC/traffic rumble below 500 Hz.
import { computeFR, fractionalOctaveSmooth, decimateLog } from './frequencyResponse';

export interface NoiseFloorResult {
  spectrum: { f: number; db: number }[];
  exceedsLowBand: boolean;
}

export function analyzeNoiseFloor(recording: Float32Array, sampleRate: number, threshDb = -50): NoiseFloorResult {
  const n = Math.min(recording.length, 16384);
  const slice = new Float64Array(n);
  for (let i = 0; i < n; i++) slice[i] = recording[i];
  const raw = computeFR(slice, sampleRate);
  const smoothed = fractionalOctaveSmooth(raw, 6);
  const decimated = decimateLog(smoothed, 64);
  const exceedsLowBand = decimated.some((p) => p.f < 500 && p.db > threshDb);
  return { spectrum: decimated, exceedsLowBand };
}
