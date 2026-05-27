// Microphone calibration: log-linear interpolation of correction curve and application to FR.
import type { MicProfile } from '../types';
import type { FRPoint } from './frequencyResponse';

export function interpolateCalibration(profile: MicProfile, frequency: number): number {
  const cal = profile.points;
  if (cal.length < 2) return 0;
  if (frequency <= cal[0][0]) return cal[0][1];
  if (frequency >= cal[cal.length - 1][0]) return cal[cal.length - 1][1];
  let lo = 0, hi = cal.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cal[mid][0] <= frequency) lo = mid; else hi = mid;
  }
  const [f1, d1] = cal[lo];
  const [f2, d2] = cal[hi];
  const t = (Math.log(frequency) - Math.log(f1)) / (Math.log(f2) - Math.log(f1));
  return d1 + t * (d2 - d1);
}

export function applyMicCorrection(points: FRPoint[], profile: MicProfile | null): FRPoint[] {
  if (!profile || profile.points.length < 2) return points;
  const cal = profile.points.slice().sort((a, b) => a[0] - b[0]);
  const sorted: MicProfile = { ...profile, points: cal };
  return points.map(({ f, db }) => ({ f, db: db + interpolateCalibration(sorted, f) }));
}
