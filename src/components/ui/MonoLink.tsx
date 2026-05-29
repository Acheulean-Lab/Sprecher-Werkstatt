// 28-px height IBM Plex Mono "link" button — the stepper-label visual idiom
// extracted for reuse on the welcome screen, project list, etc.
//
// Visual states:
//   active   → white text, white bottom border (matches stepper's active step)
//   default  → muted grey text, transparent bottom border, hover lifts to white
import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface MonoLinkProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** When true, the button renders as if it were the currently-selected item. */
  active?: boolean;
}

export const MonoLink = forwardRef<HTMLButtonElement, MonoLinkProps>(
  function MonoLink({ active = false, className = '', type = 'button', children, ...rest }, ref) {
    const base =
      'inline-flex items-center h-7 px-2 text-mono-label bg-transparent border-b transition-colors';
    const state = active
      ? 'text-white border-white hover:text-accent hover:border-accent'
      : 'text-[#939393] border-transparent hover:text-white hover:border-white';
    return (
      <button ref={ref} type={type} className={`${base} ${state} ${className}`} {...rest}>
        {children}
      </button>
    );
  }
);
