import type { ReactNode } from 'react';

export function PageShell({ title, subtitle, actions, children }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {(title || actions) && (
        <div className="max-w-6xl mx-auto px-8 pt-16 pr-20 flex items-start justify-between gap-4">
          <div>
            {title && <h1 className="text-2xl font-semibold text-ink">{title}</h1>}
            {subtitle && <p className="text-sm text-white font-light mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
    </div>
  );
}
