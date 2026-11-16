import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * One figure with its label. Money is shown in full on detail pages; `compact` tightens the tile
 * below 640 px for short counts in a row, and from 640 px it is the same tile.
 * Render tiles inside a `<dl>` (CountRow does this).
 */
export function StatTile({
  label,
  value,
  hint,
  className,
  compact,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-soft', compact ? 'p-2.5 sm:p-4' : 'p-4', className)}>
      <dt className={cn('text-muted-foreground', compact ? 'text-xs sm:text-sm' : 'text-sm')}>{label}</dt>
      <dd className={cn('font-semibold tabular break-words', compact ? 'text-lg sm:mt-1 sm:text-xl' : 'mt-1 text-xl')}>{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
