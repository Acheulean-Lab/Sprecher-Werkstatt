// Minimal functional line-art: a crisp arrow (nav/buttons), a circled check
// (completion), and a clean icon + heading row. No decorative brackets,
// dimension lines, or rules — those added noise without meaning.
import type { ReactNode } from 'react';

type Dir = 'right' | 'left' | 'up' | 'down';
const ROT: Record<Dir, number> = { right: 0, left: 180, up: -90, down: 90 };

/** Crisp engineering arrow. Inline-friendly; inherits text colour. */
export function Arrow({ dir = 'right', size = 14, className = '' }: { dir?: Dir; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`inline-block shrink-0 ${className}`}
      style={{ transform: `rotate(${ROT[dir]}deg)` }}
      aria-hidden
    >
      <line x1="2" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 5 L21 12 L14 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
    </svg>
  );
}

/** Circled check mark — completion / acknowledged state (uses currentColor). */
export function CheckMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={`shrink-0 ${className}`} aria-hidden>
      <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1" />
      <path d="M8 14.5 L12 18.5 L20 9.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

/** Section heading — Univers Bold, no rules or boxes. */
export function SectionHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-section-heading ${className}`}>{children}</h2>;
}
