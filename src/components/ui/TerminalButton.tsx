// 48 px outlined IBM Plex Mono button. Used wherever the Figma calls for
// the "terminal block" affordance — Calibrate page action buttons, etc.
import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export type TerminalButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const TerminalButton = forwardRef<HTMLButtonElement, TerminalButtonProps>(
  function TerminalButton({ className = '', type = 'button', children, ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={`terminal-btn ${className}`} {...rest}>
        {children}
      </button>
    );
  }
);
