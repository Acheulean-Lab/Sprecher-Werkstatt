import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// Square, line-art form controls. Mono input text matches the terminal vibe.
const base = 'w-full h-10 border border-border bg-black px-3 font-mono text-sm text-white placeholder:text-[#6B6B70] focus:outline-none focus:border-white transition-colors';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input className={`${base} ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props;
  return <select className={`${base} ${className}`} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea className={`w-full border border-border bg-black px-3 py-2 font-mono text-sm text-white placeholder:text-[#6B6B70] focus:outline-none focus:border-white transition-colors ${className}`} rows={3} {...rest} />;
}

export function Label({ children, htmlFor, className = '' }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return <label htmlFor={htmlFor} className={`block spec-label mb-1.5 ${className}`}>{children}</label>;
}
