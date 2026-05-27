// Apply a gated Hann window to an impulse response.
// Window starts at peak, has an initial short fade-in, runs flat, then a raised-cosine fade-out at gate end.

export function applyGatedWindow(
  ir: Float64Array,
  peakIdx: number,
  gateSamples: number,
  preSamples = 8
): Float64Array {
  const start = Math.max(0, peakIdx - preSamples);
  const end = Math.min(ir.length, start + gateSamples);
  const len = end - start;
  const out = new Float64Array(len);
  const fadeIn = Math.min(preSamples, 16);
  const fadeOut = Math.min(Math.floor(len * 0.25), Math.round(gateSamples * 0.3));
  for (let i = 0; i < len; i++) {
    let w = 1;
    if (i < fadeIn) w = 0.5 * (1 - Math.cos((Math.PI * i) / fadeIn));
    else if (i > len - fadeOut) {
      const x = (i - (len - fadeOut)) / fadeOut;
      w = 0.5 * (1 + Math.cos(Math.PI * x));
    }
    out[i] = ir[start + i] * w;
  }
  return out;
}

export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}
