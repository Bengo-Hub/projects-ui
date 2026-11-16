'use client';

import { useId, useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { SearchInput, type DebouncedSearch } from '@bengo-hub/shared-ui-lib/search';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/common/stat-tile';
import { errorText, httpStatus } from '@/lib/api/qa-invitee';
import { cn } from '@/lib/utils';

/** A list's counts: one row at every width, tighter on a phone so the list stays on the first screen. */
export function CountRow({ items, className }: { items: { label: string; value: ReactNode; hint?: ReactNode }[]; className?: string }) {
  const cols = items.length === 2 ? 'grid-cols-2' : items.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3';
  return (
    <dl className={cn('grid gap-2 sm:gap-3', cols, className)}>
      {items.map((item) => (
        <StatTile key={item.label} compact label={item.label} value={item.value} hint={item.hint} />
      ))}
    </dl>
  );
}

/**
 * The filters of a list with several of them. Below 640 px they fold behind one button, which says
 * how many are on, so the list stays on the first screen; from 640 px they always show and the
 * button is gone.
 */
export function ListFilters({ active, className, children }: { active: number; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="grid gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center justify-self-start gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-accent sm:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {active > 0 ? `Filters (${active})` : 'Filters'}
      </button>
      <div id={panelId} className={cn(className, !open && 'max-sm:hidden')}>
        {children}
      </div>
    </div>
  );
}

/** The list search box: the shared SearchInput over a `useDebouncedSearch()` state. */
export function ListSearch({ search, label, busy, className }: { search: DebouncedSearch; label: string; busy?: boolean; className?: string }) {
  return <SearchInput search={search} busy={busy} placeholder={label} label={label} className={cn('w-full sm:max-w-xs', className)} />;
}

/** A failed list says what failed and offers a retry; a 403 names the permission problem. */
export function ListError({
  error,
  title,
  forbidden = 'Your role does not include this list. Ask an administrator.',
  onRetry,
}: {
  error: unknown;
  title: string;
  forbidden?: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-border bg-card p-5">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {httpStatus(error) === 403 ? forbidden : errorText(error, 'Check the connection and try again.')}
      </p>
      <Button variant="outline" className="mt-3 h-11" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function ShowMore({ show, loading, onClick }: { show: boolean; loading: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <Button variant="outline" className="h-11 justify-self-center" disabled={loading} onClick={onClick}>
      {loading ? 'Loading more' : 'Show more'}
    </Button>
  );
}
