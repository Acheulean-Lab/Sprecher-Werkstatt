// Cumulative Spectral Decay (CSD / "waterfall") computation.
// Slides a Hann-windowed FFT along the ungated impulse response to reveal
// how energy at each frequency decays over time.
import { fftForward, magnitude, nextPow2 } from '../utils/fft';
import { hannWindow } from './windowing';

export interface CSD {
  // [slice][bin] -> dB magnitude. Slice 0 is the impulse onset, later slices are later in time.
  slices: Float32Array[];
  // Time in seconds for each slice
  sliceTimes: Float32Array;
  // Frequency in Hz for each bin
  binFreqs: Float32Array;
  fftSize: number;
}

export function computeCSD(
  ir: Float64Array | number[],
  sampleRate: number,
  numSlices = 40,
  hopMs = 0.3,
  windowMs = 8
): CSD {
  const irArr = ir instanceof Float64Array ? ir : Float64Array.from(ir);
  const hopSamples = Math.max(1, Math.round((hopMs / 1000) * sampleRate));
  const windowLen = Math.max(256, Math.round((windowMs / 1000) * sampleRate));
  const fftSize = nextPow2(windowLen) * 2;
  const win = hannWindow(windowLen);

  const slices: Float32Array[] = [];
  const sliceTimes = new Float32Array(numSlices);

  for (let s = 0; s < numSlices; s++) {
    const offset = s * hopSamples;
    sliceTimes[s] = offset / sampleRate;
    const buf = new Float64Array(fftSize);
    for (let i = 0; i < windowLen && offset + i < irArr.length; i++) {
      buf[i] = irArr[offset + i] * win[i];
    }
    const spec = fftForward(buf, fftSize);
    const mag = magnitude(spec);
    const half = fftSize / 2;
    const dB = new Float32Array(half);
    for (let i = 0; i < half; i++) dB[i] = 20 * Math.log10(Math.max(mag[i], 1e-8));
    slices.push(dB);
  }

  const binFreqs = new Float32Array(fftSize / 2);
  for (let i = 0; i < binFreqs.length; i++) binFreqs[i] = (i * sampleRate) / fftSize;

  return { slices, sliceTimes, binFreqs, fftSize };
}
