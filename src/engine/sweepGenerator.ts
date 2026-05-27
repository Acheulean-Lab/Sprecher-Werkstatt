// Log sine sweep (exponential sweep) per Farina's method.
// x(t) = sin( (2π f1 T / ln(f2/f1)) * (e^(t/T * ln(f2/f1)) - 1) )

export interface Sweep {
  samples: Float32Array;
  sampleRate: number;
  f1: number;
  f2: number;
  duration: number;
}

export function generateLogSweep(f1: number, f2: number, duration: number, sampleRate: number): Sweep {
  const N = Math.round(duration * sampleRate);
  const samples = new Float32Array(N);
  const K = (2 * Math.PI * f1 * duration) / Math.log(f2 / f1);
  const L = Math.log(f2 / f1) / duration;
  // apply short fades to avoid clicks
  const fadeSamples = Math.min(Math.round(0.01 * sampleRate), Math.floor(N / 20));
  for (let n = 0; n < N; n++) {
    const t = n / sampleRate;
    let s = Math.sin(K * (Math.exp(t * L) - 1));
    if (n < fadeSamples) s *= n / fadeSamples;
    else if (n > N - fadeSamples) s *= (N - n) / fadeSamples;
    samples[n] = s * 0.5; // headroom
  }
  return { samples, sampleRate, f1, f2, duration };
}

// Generate inverse filter by time-reversing the sweep and applying an amplitude envelope
// that compensates for the sweep's 1/f spectral density, creating a spectrally-flat impulse.
export function generateInverseFilter(sweep: Sweep): Float32Array {
  const { samples, f1, f2, duration, sampleRate } = sweep;
  const N = samples.length;
  const inv = new Float32Array(N);
  const L = Math.log(f2 / f1) / duration;
  // The reversed sweep weighted by exp(-t L) flattens the magnitude spectrum.
  for (let n = 0; n < N; n++) {
    const t = n / sampleRate;
    const env = Math.exp(-t * L);
    inv[n] = samples[N - 1 - n] * env;
  }
  return inv;
}
