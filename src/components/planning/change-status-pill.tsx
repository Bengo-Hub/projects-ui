import { CHANGE_STATUS_CLASS, CHANGE_STATUS_LABEL } from '@/lib/planning/changes';
import { cn } from '@/lib/utils';

export function ChangeStatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', CHANGE_STATUS_CLASS[status] ?? 'bg-muted text-muted-foreground', className)}>
      {CHANGE_STATUS_LABEL[status] ?? status}
    </span>
  );
}
