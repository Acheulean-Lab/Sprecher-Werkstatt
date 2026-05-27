import { fftForward, magnitude, nextPow2 } from '../utils/fft';
import { hannWindow } from './windowing';

export interface FRPoint { f: number; db: number; }
// Re-export for backwards compatibility — implementation lives in micCalibration.ts now.
export { applyMicCorrection } from './micCalibration';

// Compute frequency response from a windowed IR.
export function computeFR(windowedIR: Float64Array, sampleRate: number): FRPoint[] {
  const N = windowedIR.length;
  const win = hannWindow(N);
  const windowed = new Float64Array(N);
  for (let i = 0; i < N; i++) windowed[i] = windowedIR[i] * win[i];
  const fftSize = nextPow2(Math.max(N, 8192)) * 2;
  const padded = new Float64Array(fftSize);
  padded.set(windowed);
  const spec = fftForward(padded, fftSize);
  const mag = magnitude(spec);
  // Only positive frequencies up to Nyquist
  const points: FRPoint[] = [];
  const half = fftSize / 2;
  for (let i = 1; i < half; i++) {
    const f = (i * sampleRate) / fftSize;
    if (f < 10 || f > sampleRate / 2) continue;
    const db = 20 * Math.log10(Math.max(mag[i], 1e-12));
    points.push({ f, db });
  }
  return points;
}

// 1/N-octave fractional-octave smoothing.
export function fractionalOctaveSmooth(points: FRPoint[], fraction = 24): FRPoint[] {
  const out: FRPoint[] = [];
  const factor = Math.pow(2, 1 / (2 * fraction));
  for (let i = 0; i < points.length; i++) {
    const f0 = points[i].f;
    const fLow = f0 / factor;
    const fHigh = f0 * factor;
    let sum = 0;
    let n = 0;
    // Walk outward
    for (let j = i; j >= 0 && points[j].f >= fLow; j--) { sum += Math.pow(10, points[j].db / 10); n++; }
    for (let j = i + 1; j < points.length && points[j].f <= fHigh; j++) { sum += Math.pow(10, points[j].db / 10); n++; }
    if (n > 0) {
      const meanPower = sum / n;
      out.push({ f: f0, db: 10 * Math.log10(meanPower) });
    }
  }
  return out;
}

// Decimate to roughly K points per decade for display.
export function decimateLog(points: FRPoint[], pointsPerDecade = 96): FRPoint[] {
  if (points.length === 0) return points;
  const fMin = points[0].f;
  const fMax = points[points.length - 1].f;
  const decades = Math.log10(fMax / fMin);
  const totalPoints = Math.max(1, Math.floor(decades * pointsPerDecade));
  const out: FRPoint[] = [];
  let idx = 0;
  for (let k = 0; k <= totalPoints; k++) {
    const f = fMin * Math.pow(10, (k / totalPoints) * decades);
    while (idx + 1 < points.length && points[idx + 1].f < f) idx++;
    out.push(points[idx]);
  }
  return out;
}

// Normalize overall level so that 1kHz is at 0 dB (relative display).
export function normalizeToReference(points: FRPoint[], refHz = 1000): FRPoint[] {
  if (points.length === 0) return points;
  let ref = points[0].db;
  let refDist = Infinity;
  for (const p of points) {
    const d = Math.abs(Math.log(p.f / refHz));
    if (d < refDist) { refDist = d; ref = p.db; }
  }
  return points.map(({ f, db }) => ({ f, db: db - ref }));
}

export function keyMetrics(smoothed: FRPoint[]) {
  let sens1k = 0;
  let refDist = Infinity;
  for (const p of smoothed) {
    const d = Math.abs(Math.log(p.f / 1000));
    if (d < refDist) { refDist = d; sens1k = p.db; }
  }
  let m3Low: number | null = null;
  let m10Low: number | null = null;
  let m3High: number | null = null;
  // Walk from 1kHz down; first point dropping 3 dB from sens
  for (const p of smoothed) {
    if (p.f > 1000) break;
    if (p.db <= sens1k - 3 && m3Low === null) m3Low = p.f;
    if (p.db <= sens1k - 10 && m10Low === null) m10Low = p.f;
  }
  // reset scan for lowest crossings (walk ascending, take last one below 1k)
  m3Low = null; m10Low = null;
  let lastM3: number | null = null;
  let lastM10: number | null = null;
  for (const p of smoothed) {
    if (p.f >= 1000) break;
    if (p.db <= sens1k - 3) lastM3 = p.f;
    if (p.db <= sens1k - 10) lastM10 = p.f;
  }
  m3Low = lastM3;
  m10Low = lastM10;
  // High -3dB: first point above 1k dropping below sens-3
  for (const p of smoothed) {
    if (p.f <= 1000) continue;
    if (p.db <= sens1k - 3) { m3High = p.f; break; }
  }
  return { sensitivity1k: sens1k, minus3dbLow: m3Low, minus10dbLow: m10Low, minus3dbHigh: m3High };
}
