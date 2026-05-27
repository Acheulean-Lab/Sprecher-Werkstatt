// Wrapper over fft.js
// @ts-ignore - fft.js has no types
import FFT from 'fft.js';

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export interface Complex {
  re: Float64Array;
  im: Float64Array;
}

export function fftForward(real: Float32Array | Float64Array, size: number): Complex {
  const fft = new FFT(size);
  const out = fft.createComplexArray();
  const input = fft.createComplexArray();
  for (let i = 0; i < size; i++) {
    input[2 * i] = i < real.length ? real[i] : 0;
    input[2 * i + 1] = 0;
  }
  fft.transform(out, input);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    re[i] = out[2 * i];
    im[i] = out[2 * i + 1];
  }
  return { re, im };
}

export function fftInverse(c: Complex, size: number): Float64Array {
  const fft = new FFT(size);
  const input = fft.createComplexArray();
  const out = fft.createComplexArray();
  for (let i = 0; i < size; i++) {
    input[2 * i] = c.re[i];
    input[2 * i + 1] = c.im[i];
  }
  fft.inverseTransform(out, input);
  const result = new Float64Array(size);
  for (let i = 0; i < size; i++) result[i] = out[2 * i] / size;
  return result;
}

export function complexMul(a: Complex, b: Complex): Complex {
  const N = a.re.length;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    re[i] = a.re[i] * b.re[i] - a.im[i] * b.im[i];
    im[i] = a.re[i] * b.im[i] + a.im[i] * b.re[i];
  }
  return { re, im };
}

export function magnitude(c: Complex): Float64Array {
  const N = c.re.length;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) out[i] = Math.hypot(c.re[i], c.im[i]);
  return out;
}
