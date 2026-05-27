export type VariantTag = 'port length' | 'enclosure type' | 'driver swap' | 'EQ/DSP' | 'other';

export const CURVE_COLORS = [
  '#60A5FA', '#34D399', '#F59E0B', '#F87171', '#A78BFA', '#FB923C',
] as const;

export type DriverPosition = 'front' | 'top';
export type EnclosureType = 'sealed' | 'rear-port' | 'bottom-port';

export interface SpeakerGeometry {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  driverPosition: DriverPosition;
  enclosure: EnclosureType;
}

export const DEFAULT_GEOMETRY: SpeakerGeometry = {
  widthMm: 200,
  heightMm: 200,
  depthMm: 200,
  driverPosition: 'front',
  enclosure: 'sealed',
};

export interface Variant {
  id: string;
  name: string;
  tag: VariantTag;
  notes?: string;
  color: string;
  geometry?: SpeakerGeometry;
  measurements: Measurement[];
}

export interface SweepParams {
  f1: number;
  f2: number;
  duration: number;
  sampleRate: number;
}

export interface Measurement {
  id: string;
  name: string;
  position: string;
  notes?: string;
  timestamp: number;
  sweep: SweepParams;
  // Raw frequency response from gated IR (decimated for storage)
  frequencyResponse: { f: number; db: number }[];
  // 1/24-octave smoothed FR (the default display series)
  smoothedResponse: { f: number; db: number }[];
  // Windowed (gated ~5ms) impulse response — short, used for FR
  impulseResponse: number[];
  // Ungated impulse response (longer, ~up to 1s) — used for waterfall/CSD
  fullImpulseResponse: number[];
  peakIndex: number;
  // Applied mic profile id
  micProfileId: string | null;
  // Key metrics
  metrics: {
    sensitivity1k: number;
    minus3dbLow: number | null;
    minus10dbLow: number | null;
    minus3dbHigh: number | null;
    peakDbfs: number;
    // Impulse-response SNR — the single most reliable indicator of measurement validity.
    // < 12 dB is essentially noise; > 25 dB is a usable measurement.
    snrDb: number;
    // Absolute impulse peak amplitude (linear, deconvolved units).
    irPeak: number;
  };
  gateMs: number;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  micProfileId: string | null;
  variants: Variant[];
}

export interface MicProfile {
  id: string;
  name: string;
  builtIn: boolean;
  points: [number, number][]; // [frequency, dB correction]
}

// Mic placement vector in the speaker's local frame.
// +x = right, +y = up, +z = front. The vector points FROM the speaker TO
// the mic (i.e. the mic sits in this direction at the given relative distance).
export interface MicPlacement {
  /** Unit vector pointing from speaker center toward the mic. */
  dir: [number, number, number];
  /** Distance in arbitrary cube-relative units (1.0 ≈ one cube max-dimension). */
  distance: number;
  /** If true, the mic targets the woofer / port instead of the speaker centre. */
  nearField?: 'cone' | 'port';
}

export interface PositionPreset {
  id: string;
  label: string;
  angle: number;
  hint: string;
  mic: MicPlacement;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const horiz = (deg: number): MicPlacement => ({
  dir: [Math.sin(rad(deg)), 0, Math.cos(rad(deg))],
  distance: 1.4,
});
const vert = (deg: number): MicPlacement => ({
  dir: [0, Math.sin(rad(deg)), Math.cos(rad(deg))],
  distance: 1.4,
});

export const POSITION_PRESETS: PositionPreset[] = [
  { id: 'on-axis', label: 'On-axis (0°)', angle: 0, hint: 'Stand directly in front of the speaker at tweeter height, about 1 meter away. Point the microphone directly at the tweeter.', mic: horiz(0) },
  { id: 'h-15', label: '15° horizontal off-axis', angle: 15, hint: 'Slightly to the side, same height, 1 meter. Keep mic pointed at the tweeter.', mic: horiz(15) },
  { id: 'h-30', label: '30° horizontal off-axis', angle: 30, hint: 'Further to the side, same height, 1 meter.', mic: horiz(30) },
  { id: 'h-45', label: '45° horizontal off-axis', angle: 45, hint: 'Further still to the side, same height, 1 meter.', mic: horiz(45) },
  { id: 'h-60', label: '60° horizontal off-axis', angle: 60, hint: 'Wide off-axis, same height, 1 meter.', mic: horiz(60) },
  { id: 'v-15', label: '15° vertical off-axis', angle: 15, hint: 'Slightly above or below tweeter axis, 1 meter.', mic: vert(15) },
  { id: 'v-30', label: '30° vertical off-axis', angle: 30, hint: 'Further above/below tweeter axis, 1 meter.', mic: vert(30) },
  { id: 'rear', label: 'Rear (180°)', angle: 180, hint: 'Behind the speaker, 1 meter away.', mic: { dir: [0, 0, -1], distance: 1.4 } },
  { id: 'nf-cone', label: 'Near-field (cone)', angle: 0, hint: 'Very close, ~10–15cm from woofer cone center.', mic: { dir: [0, 0, 1], distance: 0.75, nearField: 'cone' } },
  { id: 'nf-port', label: 'Near-field (port)', angle: 0, hint: 'Very close, ~10–15cm from port opening.', mic: { dir: [0, -1, 0], distance: 0.75, nearField: 'port' } },
];
