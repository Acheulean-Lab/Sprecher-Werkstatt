// Horizontal stepper with an animated white underline that slides between
// labels as the active index changes. Text colour cross-fades white ↔ grey
// in lockstep with the bar movement.
//
// Generic over the label strings — used by the measurement wizard, but
// nothing prevents using it elsewhere.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface StepperProps {
  labels: string[];
  activeIndex: number;
}

const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
const SLIDE_MS = 360;
const FADE_MS = 220;

export function Stepper({ labels, activeIndex }: StepperProps) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [bar, setBar] = useState<{ left: number; width: number; top: number } | null>(null);
  // Disable the slide animation on first mount so the underline lands at its
  // starting position rather than visibly sliding in from `left: 0`.
  const [hasMounted, setHasMounted] = useState(false);

  // Measure the active item's box before paint so the bar lands exactly under it.
  useLayoutEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (!el) return;
    setBar({
      left: el.offsetLeft,
      width: el.offsetWidth,
      top: el.offsetTop + el.offsetHeight,
    });
  }, [activeIndex]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Re-measure on resize — font hinting shifts label widths.
  useEffect(() => {
    const onResize = () => {
      const el = itemRefs.current[activeIndex];
      if (!el) return;
      setBar({
        left: el.offsetLeft,
        width: el.offsetWidth,
        top: el.offsetTop + el.offsetHeight,
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeIndex]);

  return (
    <div className="relative flex items-start gap-[18px] pb-1">
      {labels.map((label, i) => {
        const active = i === activeIndex;
        return (
          <div
            key={label}
            ref={(el) => { itemRefs.current[i] = el; }}
            className="flex items-start h-7 px-2"
          >
            <span
              className={`text-mono-label !text-base ${active ? 'text-white' : 'text-[#939393]'}`}
              style={{ transition: `color ${FADE_MS}ms ${EASE}` }}
            >
              {label}
            </span>
          </div>
        );
      })}
      {bar && (
        <div
          aria-hidden
          className="absolute h-px bg-white pointer-events-none"
          style={{
            left: bar.left,
            width: bar.width,
            top: bar.top,
            transition: hasMounted
              ? `left ${SLIDE_MS}ms ${EASE}, width ${SLIDE_MS}ms ${EASE}`
              : 'none',
          }}
        />
      )}
    </div>
  );
}
