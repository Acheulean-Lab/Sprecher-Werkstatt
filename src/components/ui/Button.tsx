import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// Line-art / terminal language: square corners, IBM Plex Mono, uppercase.
const base = 'inline-flex items-center justify-center gap-2 font-mono uppercase tracking-[0.04em] whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none';

const variants: Record<Variant, string> = {
  // Primary CTAs: white outline by default, snap to accent on hover —
  // the only chrome where accent appears as an interactive cue.
  primary: 'border border-white bg-transparent text-white hover:border-accent hover:text-accent',
  // Secondary: soft-grey outline + muted text, lifts to white on hover.
  secondary: 'border border-border bg-transparent text-[#9CA3A0] hover:border-white hover:text-white',
  // Ghost: no border, muted → white.
  ghost: 'bg-transparent text-[#9CA3A0] hover:text-white',
  // Danger: outline-only, fills lightly on hover.
  danger: 'border border-danger bg-transparent text-danger hover:bg-danger/15',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className = '', ...rest }, ref
) {
  return <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
});
