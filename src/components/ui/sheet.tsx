'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A side sheet on Radix Dialog (focus trap, Escape, labelled): full screen on phones, a panel on
 * the right from the md breakpoint.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  headerActions,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 max-md:hidden" />
        <Dialog.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-background shadow-xl outline-none',
            'md:inset-y-0 md:left-auto md:right-0 md:w-[min(42rem,100vw)] md:border-l md:border-border',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
            className,
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start gap-2 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold leading-snug">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">{description}</Dialog.Description>}
            </div>
            {headerActions}
            <Dialog.Close
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
