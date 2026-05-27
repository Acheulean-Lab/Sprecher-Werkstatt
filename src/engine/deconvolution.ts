import { fftForward, fftInverse, complexMul, nextPow2 } from '../utils/fft';
import type { Sweep } from './sweepGenerator';
import { generateInverseFilter } from './sweepGenerator';

// Recover the impulse response by convolving the recording with the inverse filter.
// Convolution in frequency domain = multiplication.
export function deconvolve(recording: Float32Array, sweep: Sweep): Float64Array {
  const inv = generateInverseFilter(sweep);
  const size = nextPow2(recording.length + inv.length);
  const R = fftForward(recording, size);
  const I = fftForward(inv, size);
  const product = complexMul(R, I);
  const ir = fftInverse(product, size);
  return ir;
}

// The direct impulse appears at the location corresponding to the end of the sweep plus latency.
// Find it as the sample of maximum absolute value within a reasonable search window.
export function findImpulsePeak(ir: Float64Array, searchStart: number, searchEnd: number): number {
  let peakIdx = searchStart;
  let peakVal = 0;
  const end = Math.min(searchEnd, ir.length);
  for (let i = searchStart; i < end; i++) {
    const v = Math.abs(ir[i]);
    if (v > peakVal) { peakVal = v; peakIdx = i; }
  }
  return peakIdx;
}
