import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useMemo } from 'react';

export interface Series {
  name: string;
  color: string;
  data: { f: number; db: number }[];
}

const X_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

function yTicks(min: number, max: number): number[] {
  const span = max - min;
  const step = span <= 30 ? 5 : span <= 60 ? 10 : 20;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export function FrequencyChart({ series, height = 420, yMin, yMax, diffSeries }: {
  series: Series[];
  height?: number;
  /** Explicit lower bound. If omitted, auto-fits to the data. */
  yMin?: number;
  /** Explicit upper bound. If omitted, auto-fits to the data. */
  yMax?: number;
  diffSeries?: Series | null;
}) {
  // Merge into a single data array keyed by frequency — use the first series's freq grid, others are looked up.
  const merged = useMemo(() => {
    if (series.length === 0) return [];
    const grid = series[0].data.map((p) => p.f);
    return grid.map((f, i) => {
      const row: Record<string, number> = { f, logf: Math.log10(f) };
      series.forEach((s) => {
        const pt = s.data[i];
        if (pt) row[s.name] = pt.db;
      });
      if (diffSeries) {
        const pt = diffSeries.data[i];
        if (pt) row[diffSeries.name] = pt.db;
      }
      return row;
    });
  }, [series, diffSeries]);

  // Auto-fit Y-axis to actual data range, ignoring the diff series (which lives
  // on a separate axis). Pads ±5 dB and snaps to a 5 dB grid so ticks land
  // cleanly. The explicit yMin/yMax props override when given (e.g. the
  // noise-floor chart pins -120..0).
  const [autoMin, autoMax] = useMemo<[number, number]>(() => {
    if (merged.length === 0) return [-40, 10];
    const diffName = diffSeries?.name;
    let lo = Infinity, hi = -Infinity;
    for (const row of merged) {
      for (const key of Object.keys(row)) {
        if (key === 'f' || key === 'logf' || key === diffName) continue;
        const v = row[key];
        if (typeof v !== 'number' || !isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return [-40, 10];
    const span = Math.max(hi - lo, 1);
    const pad = Math.max(3, span * 0.08);
    let min = Math.floor((lo - pad) / 5) * 5;
    let max = Math.ceil((hi + pad) / 5) * 5;
    // Guarantee at least 20 dB of visual range so a flat curve doesn't look squished.
    if (max - min < 20) {
      const mid = (max + min) / 2;
      min = Math.floor((mid - 10) / 5) * 5;
      max = Math.ceil((mid + 10) / 5) * 5;
    }
    return [min, max];
  }, [merged, diffSeries]);

  const finalMin = yMin ?? autoMin;
  const finalMax = yMax ?? autoMax;

  if (series.length === 0) {
    return <div className="h-40 flex items-center justify-center spec-label panel">No data</div>;
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="spec-label">SPL · dB / Hz</span>
        <span className="spec-label">20 – 20k Hz · log</span>
      </div>
      <div className="p-4">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={merged} margin={{ top: 10, right: 40, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#2A2A2E" strokeDasharray="3 3" />
          <XAxis
            dataKey="logf"
            type="number"
            domain={[Math.log10(20), Math.log10(20000)]}
            ticks={X_TICKS.map((t) => Math.log10(t))}
            tickFormatter={(v) => {
              const f = Math.pow(10, v);
              if (f >= 1000) return `${Math.round(f / 1000)}k`;
              return `${Math.round(f)}`;
            }}
            stroke="#9C9A96"
            tick={{ fill: '#9C9A96', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          />
          <YAxis
            domain={[finalMin, finalMax]}
            ticks={yTicks(finalMin, finalMax)}
            stroke="#9C9A96"
            width={56}
            tick={{ fill: '#9C9A96', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            tickFormatter={(v) => `${Math.round(Number(v))} dB`}
          />
          {diffSeries && (
            <YAxis yAxisId="diff" orientation="right" domain={[-20, 20]} stroke="#6B6760" tick={{ fill: '#6B6760', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
          )}
          <Tooltip
            contentStyle={{ background: '#000000', border: '1px solid #3F3F46', borderRadius: 0, fontSize: 12 }}
            labelFormatter={(v) => `${Math.round(Math.pow(10, Number(v)))} Hz`}
            formatter={(val: unknown, name: unknown) => [`${Number(val).toFixed(1)} dB`, String(name)]}
            itemStyle={{ color: '#9C9A96' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9C9A96' }} />
          <ReferenceLine y={0} stroke="#2A2A2E" />
          {series.map((s) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
          ))}
          {diffSeries && (
            <Line yAxisId="diff" type="monotone" dataKey={diffSeries.name} stroke={diffSeries.color} strokeDasharray="4 4" dot={false} strokeWidth={1.25} isAnimationActive={false} connectNulls />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
