import { LineChart, Line, XAxis, YAxis, ReferenceLine, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Measurement } from '../../types';

export function ImpulseView({ measurement }: { measurement: Measurement }) {
  const sr = measurement.sweep.sampleRate;
  const data = measurement.impulseResponse.map((y, i) => ({ t: ((i - 16) / sr) * 1000, y }));
  const gateEnd = measurement.gateMs;
  return (
    <div className="border border-border rounded-card p-4">
      <div className="text-xs font-mono text-charttext uppercase tracking-wide mb-2">Impulse response</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#2A2A2E" strokeDasharray="3 3" />
          <XAxis dataKey="t" type="number" domain={[-1, 20]} stroke="#9C9A96" tick={{ fill: '#9C9A96', fontSize: 11, fontFamily: 'IBM Plex Mono' }} label={{ value: 'ms', fill: '#9C9A96', position: 'insideBottomRight', style: { fontSize: 10 } }} />
          <YAxis stroke="#9C9A96" tick={{ fill: '#9C9A96', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
          <Tooltip contentStyle={{ background: '#000000', border: '1px solid #3F3F46', borderRadius: 6, fontSize: 12 }} itemStyle={{ color: '#9C9A96' }} formatter={(v: unknown) => Number(v).toFixed(4)} />
          <ReferenceLine x={0} stroke="#FAF600" strokeDasharray="2 2" label={{ value: 'peak', fill: '#FAF600', fontSize: 10 }} />
          <ReferenceLine x={gateEnd} stroke="#FF9E00" strokeDasharray="2 2" label={{ value: `gate ${gateEnd}ms`, fill: '#FF9E00', fontSize: 10 }} />
          <Line type="monotone" dataKey="y" stroke="#60A5FA" dot={false} strokeWidth={1.25} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
