// AudioLevelMeter — a row of rectangular bars representing live input level.
//
// Design spec (Figma node 260:1162 "Audio level componet"):
//   • 22 bars total, 8 px wide × 16 px tall, 4 px gap
//   • Filled bars (bg-white)   → level reached that bar
//   • Outline bars (border-white) → level has not reached that bar
//
// The dbfs prop is the live peak level in dBFS (−60 … 0).
// We map that linearly onto the 22-bar range so that:
//   −60 dBFS → 0 bars filled (silence)
//     0 dBFS → 22 bars filled (full scale / clipping)

const BARS = 22;
const DB_MIN = -60;
const DB_MAX = 0;

interface AudioLevelMeterProps {
  dbfs: number;
  className?: string;
}

export function AudioLevelMeter({ dbfs, className = '' }: AudioLevelMeterProps) {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, dbfs));
  const filled = Math.round(((clamped - DB_MIN) / (DB_MAX - DB_MIN)) * BARS);

  return (
    <div className={`flex items-center gap-[4px] h-[18px] ${className}`} aria-hidden>
      {Array.from({ length: BARS }).map((_, i) => (
        i < filled ? (
          <div key={i} className="w-[8px] h-[16px] bg-white shrink-0" />
        ) : (
          <div key={i} className="w-[8px] h-[16px] border-2 border-white shrink-0" />
        )
      ))}
    </div>
  );
}
