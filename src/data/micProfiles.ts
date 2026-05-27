import type { MicProfile } from '../types';

// Typical generic correction curves. Users with measurement mics should upload their
// unit-specific .cal file for true accuracy.

const flat: [number, number][] = [[20, 0], [20000, 0]];

// MacBook Pro built-in mic — rolled off lows, mild presence rise, sharp top-end roll-off.
const macbook: [number, number][] = [
  [20, 18.0], [40, 12.0], [60, 8.0], [80, 5.5], [100, 4.0],
  [200, 2.0], [400, 0.8], [800, 0.0],
  [1000, 0.0], [2000, -0.5], [3000, -1.5], [4000, -2.5],
  [6000, -3.0], [8000, -2.0], [10000, -1.5], [12000, 1.0], [15000, 4.0], [20000, 9.0],
];

// Shure SM58 dynamic — bass roll-off, mid presence peak, gentle highs.
const shureSM58: [number, number][] = [
  [20, 18.0], [50, 8.0], [100, 4.0], [200, 1.0], [500, 0.0],
  [1000, 0.0], [2000, -1.5], [3000, -3.5], [4000, -5.0],
  [5000, -4.0], [6000, -2.0], [8000, 1.0], [10000, 3.0], [12000, 6.0], [15000, 12.0], [20000, 20.0],
];

// Shure SM57 instrument — similar but flatter low-mids and brighter presence peak.
const shureSM57: [number, number][] = [
  [20, 16.0], [50, 7.0], [100, 3.0], [200, 0.5], [500, 0.0],
  [1000, 0.0], [2000, -2.0], [4000, -4.5], [6000, -2.5],
  [8000, 0.5], [10000, 2.5], [12000, 5.0], [15000, 9.0], [20000, 16.0],
];

export const BUILT_IN_PROFILES: MicProfile[] = [
  { id: 'flat', name: 'Generic flat (no correction)', builtIn: true, points: flat },
  { id: 'macbook', name: 'MacBook Pro built-in', builtIn: true, points: macbook },
  { id: 'shure-sm58', name: 'Shure SM58', builtIn: true, points: shureSM58 },
  { id: 'shure-sm57', name: 'Shure SM57', builtIn: true, points: shureSM57 },
];

export function parseCalFile(text: string): [number, number][] {
  const lines = text.split(/\r?\n/);
  const points: [number, number][] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('*') || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    if (/sens\s*factor/i.test(trimmed)) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const f = parseFloat(parts[0]);
    const db = parseFloat(parts[1]);
    if (!isNaN(f) && !isNaN(db) && f > 0) points.push([f, db]);
  }
  return points;
}
