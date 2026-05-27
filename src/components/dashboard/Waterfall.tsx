import { useEffect, useRef } from 'react';
import type { Measurement } from '../../types';
import { computeCSD } from '../../engine/waterfall';

// Cumulative Spectral Decay rendered as an oblique-projected 3D ribbon stack.
// X = log frequency, Z (depth) = time after impulse, Y = magnitude.
export function Waterfall({ measurement, height = 360 }: { measurement: Measurement; height?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sr = measurement.sweep.sampleRate;
    // Prefer ungated for true CSD; fall back to gated snippet for older saved measurements.
    const ir = measurement.fullImpulseResponse?.length ? measurement.fullImpulseResponse : measurement.impulseResponse;
    const csd = computeCSD(ir, sr, 36, 0.4, 6);

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const fMin = 100;
    const fMax = sr / 2;
    const logMin = Math.log10(fMin);
    const logMax = Math.log10(fMax);

    const dbMin = -80;
    const dbMax = 0;

    // Oblique projection: each successive slice shifted up-right.
    const padL = 50, padR = 30, padT = 30, padB = 40;
    const baseW = w - padL - padR;
    const baseH = h - padT - padB;
    const skewX = baseW * 0.18;
    const skewY = baseH * 0.55;
    const ribbonH = baseH - skewY;

    const numSlices = csd.slices.length;
    const cols = 240;

    // Draw from back to front so foreground occludes background.
    for (let s = numSlices - 1; s >= 0; s--) {
      const sliceFrac = s / Math.max(1, numSlices - 1);
      const xOff = padL + sliceFrac * skewX;
      const yOff = padT + sliceFrac * skewY;

      const slice = csd.slices[s];

      // Build polyline for the ribbon top
      const top: [number, number][] = [];
      for (let c = 0; c < cols; c++) {
        const cFrac = c / (cols - 1);
        const f = Math.pow(10, logMin + cFrac * (logMax - logMin));
        const idx = Math.min(slice.length - 1, Math.round((f * csd.fftSize) / sr));
        const db = slice[idx];
        const dbT = Math.max(0, Math.min(1, (db - dbMin) / (dbMax - dbMin)));
        const x = xOff + cFrac * baseW;
        const y = yOff + (1 - dbT) * ribbonH;
        top.push([x, y]);
      }

      // Fill area down to baseline
      const baselineY = yOff + ribbonH;
      ctx.beginPath();
      ctx.moveTo(top[0][0], baselineY);
      for (const [x, y] of top) ctx.lineTo(x, y);
      ctx.lineTo(top[top.length - 1][0], baselineY);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, hexA(viridis(1 - sliceFrac), 0.85));
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke the top ridge
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (const [x, y] of top) ctx.lineTo(x, y);
      ctx.strokeStyle = viridis(1 - sliceFrac);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Frequency axis (log)
    ctx.fillStyle = '#9C9A96';
    ctx.font = '10px "IBM Plex Mono"';
    for (const label of [100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
      if (label < fMin || label > fMax) continue;
      const cFrac = (Math.log10(label) - logMin) / (logMax - logMin);
      const x = padL + cFrac * baseW;
      const y = padT + skewY + ribbonH + 4;
      ctx.fillRect(x, y, 1, 4);
      ctx.fillText(label >= 1000 ? `${label / 1000}k` : `${label}`, x + 3, y + 14);
    }
    // Time-axis hint
    ctx.fillStyle = '#9C9A96';
    ctx.fillText(`time → ${(csd.sliceTimes[csd.sliceTimes.length - 1] * 1000).toFixed(0)} ms`, padL + skewX + 6, padT + 12);
    ctx.fillText('freq', padL + baseW + skewX - 26, padT + skewY + ribbonH + 18);
  }, [measurement]);

  return (
    <div className="border border-border rounded-card p-4">
      <div className="flex justify-between text-xs font-mono text-charttext uppercase tracking-wide mb-2">
        <span>Cumulative spectral decay (CSD)</span>
        <span>−80 → 0 dB · viridis</span>
      </div>
      <canvas ref={ref} width={760} height={height} className="w-full block" />
    </div>
  );
}

function hexA(hex: string, alpha: number): string {
  // hex like "rgb(r,g,b)"
  const m = hex.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return hex;
  return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
}

function viridis(t: number): string {
  const stops: [number, number, number, number][] = [
    [0.0, 68, 1, 84],
    [0.33, 58, 82, 139],
    [0.66, 32, 144, 141],
    [1.0, 253, 231, 37],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const f = (t - a[0]) / (b[0] - a[0]);
      const r = Math.round(a[1] + f * (b[1] - a[1]));
      const g = Math.round(a[2] + f * (b[2] - a[2]));
      const bl = Math.round(a[3] + f * (b[3] - a[3]));
      return `rgb(${r},${g},${bl})`;
    }
  }
  return 'rgb(0,0,0)';
}
