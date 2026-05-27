import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const base = 'w-full h-10 rounded-btn border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-white';

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
  return <textarea className={`w-full rounded-btn border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-white ${className}`} rows={3} {...rest} />;
}

export function Label({ children, htmlFor, className = '' }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return <label htmlFor={htmlFor} className={`block text-xs font-medium text-white font-light mb-1.5 ${className}`}>{children}</label>;
}
