// Horizontal peak-hold dBFS meter, -60..0 dB range.
export function LevelMeter({ dbfs }: { dbfs: number }) {
  const min = -60;
  const max = 0;
  const clamped = Math.max(min, Math.min(max, dbfs));
  const pct = ((clamped - min) / (max - min)) * 100;
  // Clipping → danger red, hot → warn orange, otherwise → success
  const color = dbfs > -3 ? '#F02640' : dbfs > -12 ? '#FF9E00' : '#FAF600';
  return (
    <div className="w-full">
      <div className="relative h-3 w-full bg-chartbg rounded-full overflow-hidden">
        <div className="h-full transition-[width] duration-75" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-mono text-white">
        <span>-60</span><span>-24</span><span>-12</span><span>-3</span><span>0 dBFS</span>
      </div>
      <div className="mt-1 text-xs font-mono text-ink">peak: {isFinite(dbfs) ? dbfs.toFixed(1) : '—'} dBFS</div>
    </div>
  );
}
