'use client';

import { Info, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { cn } from '@/lib/utils';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

const ICONS: Record<ConfirmVariant, LucideIcon> = { danger: Trash2, warning: TriangleAlert, info: Info };
const ICON_CLASS: Record<ConfirmVariant, string> = {
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-primary/10 text-primary',
};

/** Confirmation for destructive or sensitive actions. Never use window.confirm. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'info',
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: ConfirmVariant;
  loading?: boolean;
}) {
  const Icon = ICONS[variant];
  return (
    <QADialog open={open} onOpenChange={onOpenChange} title={title} description={description} className="sm:max-w-md">
      <div className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', ICON_CLASS[variant])} aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex flex-1 flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'danger' ? 'destructive' : 'default'} disabled={loading} onClick={onConfirm}>
            {loading ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </div>
    </QADialog>
  );
}
