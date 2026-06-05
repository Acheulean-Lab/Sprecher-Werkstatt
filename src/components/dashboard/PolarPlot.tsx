import { useMemo } from 'react';
import type { Measurement } from '../../types';

interface PolarEntry {
  id: string;
  name: string;
  color: string;
  measurements: Measurement[];
}

// Simple SVG polar plot of SPL vs angle at a chosen frequency.
export function PolarPlot({ variants, frequency = 1000, size = 360 }: { variants: PolarEntry[]; frequency?: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 30;

  const data = useMemo(() => {
    return variants.map((v) => {
      const points: { angle: number; db: number }[] = [];
      for (const m of v.measurements) {
        const angleMatch = m.position.match(/(\d+)°/);
        if (!angleMatch) continue;
        const angle = parseFloat(angleMatch[1]);
        const closest = m.frequencyResponse.reduce((best, p) => Math.abs(Math.log(p.f / frequency)) < Math.abs(Math.log(best.f / frequency)) ? p : best, m.frequencyResponse[0]);
        if (closest) points.push({ angle, db: closest.db });
      }
      points.sort((a, b) => a.angle - b.angle);
      return { variant: v, points };
    });
  }, [variants, frequency]);

  const dbMin = -20;
  const dbMax = 10;
  const dbToR = (db: number) => {
    const t = Math.max(0, Math.min(1, (db - dbMin) / (dbMax - dbMin)));
    return t * maxR;
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="spec-label">SPL vs angle</span>
        <span className="spec-label">@ {frequency >= 1000 ? `${frequency / 1000} kHz` : `${frequency} Hz`}</span>
      </div>
      <div className="p-4">
      <svg width={size} height={size} className="block mx-auto">
        {[-10, 0, 10].map((db) => (
          <circle key={db} cx={cx} cy={cy} r={dbToR(db)} fill="none" stroke="#2A2A2E" strokeDasharray="2 3" />
        ))}
        {[0, 15, 30, 45, 60, 90].map((a) => {
          const rad = (a * Math.PI) / 180;
          const x = cx + maxR * Math.sin(rad);
          const y = cy - maxR * Math.cos(rad);
          return (
            <g key={a}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#2A2A2E" />
              <text x={x} y={y - 4} fontSize={10} textAnchor="middle" fill="#9C9A96" fontFamily="IBM Plex Mono">{a}°</text>
            </g>
          );
        })}
        {data.map(({ variant, points }) => {
          if (points.length < 2) return null;
          const d = points.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const r = dbToR(p.db);
            const x = cx + r * Math.sin(rad);
            const y = cy - r * Math.cos(rad);
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
          }).join(' ');
          return <path key={variant.id} d={d} stroke={variant.color} strokeWidth={1.5} fill={variant.color + '33'} />;
        })}
      </svg>
      <div className="flex flex-wrap gap-3 justify-center mt-3">
        {variants.map((v) => (
          <div key={v.id} className="flex items-center gap-2 spec-label">
            <span className="w-2 h-2" style={{ backgroundColor: v.color }} />{v.name}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
