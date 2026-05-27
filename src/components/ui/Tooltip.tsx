import * as RT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RT.Provider delayDuration={200}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content side="top" sideOffset={6} className="max-w-xs rounded-btn bg-ink text-white text-xs px-3 py-2 shadow-lg z-50">
            {content}
            <RT.Arrow className="fill-ink" />
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}

export function InfoDot({ text }: { text: string }) {
  return (
    <Tooltip content={text}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-border text-white font-light text-[10px] font-medium cursor-help ml-1">i</span>
    </Tooltip>
  );
}
