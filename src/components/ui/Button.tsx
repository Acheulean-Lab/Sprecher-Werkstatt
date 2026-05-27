import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base = 'inline-flex items-center justify-center gap-2 rounded-btn font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent/30';

const variants: Record<Variant, string> = {
  // Primary CTAs: white outline by default, snap to accent (border + text)
  // on hover — the only chrome where accent appears as an interactive cue.
  primary: 'border border-white bg-transparent text-white hover:border-accent hover:text-accent',
  // Secondary / ghost — soft grey by default, white on hover. No fill.
  secondary: 'border border-border bg-transparent text-ink hover:border-white',
  ghost: 'bg-transparent text-ink hover:text-white',
  // Danger is outline-only too; on hover the danger colour fills lightly.
  danger: 'border border-danger bg-transparent text-danger hover:bg-danger/15',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className = '', ...rest }, ref
) {
  return <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
});
