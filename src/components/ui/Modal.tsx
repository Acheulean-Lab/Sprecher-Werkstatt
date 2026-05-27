import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  dismissable?: boolean;
}

export function Modal({ open, onOpenChange, title, description, children, dismissable = true }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={dismissable ? onOpenChange : undefined}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          onInteractOutside={(e) => { if (!dismissable) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (!dismissable) e.preventDefault(); }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black border border-border rounded-card max-w-lg w-[90vw] p-6 z-50 focus:outline-none"
        >
          {title && <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>}
          {description && <Dialog.Description className="text-sm text-white font-light mt-1">{description}</Dialog.Description>}
          <div className={title ? 'mt-4' : ''}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
