// TerminalDropdown — a terminal-styled select replacement.
//
// Renders as a solid-border IBM Plex Mono button showing the current value
// (or a placeholder).  On click, a black-background panel of options
// floats below — each option matches the same mono style.
//
// This replaces native <select> elements so the UI stays completely
// within the project's terminal design language.
import { useEffect, useRef, useState } from 'react';

export interface TerminalDropdownOption {
  value: string;
  label: string;
}

interface TerminalDropdownProps {
  value: string;
  options: TerminalDropdownOption[];
  onChange: (value: string) => void;
  /** Text shown when value matches none of the options, or as a hint. */
  placeholder?: string;
  className?: string;
}

export function TerminalDropdown({
  value,
  options,
  onChange,
  placeholder = 'SELECT',
  className = '',
}: TerminalDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const current = options.find((o) => o.value === value);
  const display = current ? current.label : placeholder;

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-12 px-3 border border-white bg-transparent text-mono-label text-white
                   hover:border-accent hover:text-accent transition-colors
                   focus:outline-none focus:ring-2 focus:ring-accent/30
                   inline-flex items-center gap-2 whitespace-nowrap"
      >
        {display}
      </button>

      {/* Options panel */}
      {open && (
        <div className="absolute left-0 top-full mt-[2px] z-50 min-w-full bg-black border border-white">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-mono-label whitespace-nowrap transition-colors
                  ${active
                    ? 'text-black bg-white'
                    : 'text-white hover:bg-white hover:text-black'
                  }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
