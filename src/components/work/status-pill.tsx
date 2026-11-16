'use client';

import type { ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import type { ProjectStatus } from '@/types';

export const PRIORITY_OPTIONS: ComboboxOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];
import { cn } from '@/lib/utils';

const CATEGORY_CLASS: Record<ProjectStatus['category'], string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  done: 'bg-success/15 text-success',
};

export function statusOf(statuses: ProjectStatus[] | undefined, key: string): ProjectStatus | undefined {
  return statuses?.find((s) => s.key === key);
}

/** A readable name for a status key, from the project's statuses when known. */
export function statusLabel(statuses: ProjectStatus[] | undefined, key: string): string {
  return statusOf(statuses, key)?.label ?? key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusPill({ status, statuses, className }: { status: string; statuses?: ProjectStatus[]; className?: string }) {
  const s = statusOf(statuses, status);
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', CATEGORY_CLASS[s?.category ?? 'todo'], className)}>
      {statusLabel(statuses, status)}
    </span>
  );
}
