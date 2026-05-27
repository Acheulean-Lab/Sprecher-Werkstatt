import type { ReactNode } from 'react';

export function Badge({ children, color, className = '' }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge border border-border bg-surface px-2 py-0.5 text-xs text-ink ${className}`}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </span>
  );
}
