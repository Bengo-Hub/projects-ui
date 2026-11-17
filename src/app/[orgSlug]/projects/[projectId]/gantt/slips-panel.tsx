'use client';

import { useMemo } from 'react';
import { CalendarCheck } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { CountRow } from '@/components/common/list-parts';
import { StatusPill } from '@/components/work/status-pill';
import { useSlips } from '@/hooks/useBaselines';
import { isNotFound } from '@/lib/api/errors';
import type { Slip } from '@/lib/api/planning';
import { finishChange, slipClass, slipSummary, slipText, sortSlips } from '@/lib/planning/baselines';
import type { ProjectStatus } from '@/types';
import { cn } from '@/lib/utils';

/** The slips report (US-16.2): what moved since the baseline, the biggest slip first. */
export function SlipsPanel({ orgSlug, projectId, baselineId, statuses }: { orgSlug: string; projectId: string; baselineId: string; statuses: ProjectStatus[] }) {
  const { data, isLoading, isError, error } = useSlips(orgSlug, projectId, baselineId);
  const rows = useMemo(() => sortSlips(data?.slips ?? []), [data]);

  const columns = useMemo<DataTableColumn<Slip>[]>(
    () => [
      {
        key: 'title',
        header: 'Item',
        primary: true,
        render: (s) => (
          <span className="min-w-0">
            <span className="font-medium">{s.title}</span>
            {s.kind === 'milestone' && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Milestone</span>}
          </span>
        ),
      },
      {
        key: 'change',
        header: 'Finish',
        mobileAction: true,
        accessor: (s) => s.finish_slip_days,
        render: (s) => <span className={cn('font-medium', slipClass(s.finish_slip_days))}>{finishChange(s)}</span>,
      },
      { key: 'baseline', header: 'Planned finish', accessor: (s) => s.baseline_finish ?? '', render: (s) => formatDate(s.baseline_finish ?? undefined, null, { fallback: 'None' }) },
      { key: 'current', header: 'Now due', accessor: (s) => s.current_finish ?? '', render: (s) => formatDate(s.current_finish ?? undefined, null, { fallback: 'None' }) },
      {
        key: 'start',
        header: 'Start',
        hideBelow: 'lg',
        accessor: (s) => s.start_slip_days,
        render: (s) => <span className={slipClass(s.start_slip_days)}>{s.kind === 'task' ? slipText(s.start_slip_days) : '-'}</span>,
      },
      {
        key: 'estimate',
        header: 'Estimate',
        hideBelow: 'lg',
        align: 'right',
        accessor: (s) => s.estimate_change_hours,
        render: (s) => (s.estimate_change_hours ? `${s.estimate_change_hours > 0 ? '+' : ''}${s.estimate_change_hours} h` : '-'),
      },
      {
        key: 'status',
        header: 'Status',
        hideBelow: 'md',
        render: (s) => (s.status && s.kind === 'task' ? <StatusPill status={s.status} statuses={statuses} /> : null),
      },
    ],
    [statuses],
  );

  if (isLoading) return <PageLoading />;
  if (isNotFound(error)) return <EmptyState icon={CalendarCheck} title="No baseline yet" description="Save a baseline from the timeline, then come back to see what slipped." />;
  if (isError || !data) return <ErrorBanner message="The slips report could not be loaded." />;

  return (
    <section className="space-y-4" aria-label="Slips" data-testid="slips-panel">
      <p className="text-sm text-muted-foreground">
        Against <span className="font-medium text-foreground">{data.baseline.name}</span>, saved {formatDate(data.baseline.created_at)}. {slipSummary(data)}
      </p>
      <CountRow
        items={[
          { label: 'Slipped', value: data.slipped },
          { label: 'Pulled in', value: data.pulled_in },
          { label: 'Worst slip', value: data.max_slip_days > 0 ? `${data.max_slip_days} d` : '-' },
          { label: 'Milestones late', value: data.milestones_slipped },
        ]}
      />
      {(data.added_since > 0 || data.removed_since > 0) && (
        <p className="text-xs text-muted-foreground" data-testid="slips-added-removed">
          Since the baseline: {data.added_since} {data.added_since === 1 ? 'task' : 'tasks'} added, {data.removed_since} removed.
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Nothing slipped" description="Every task and milestone still finishes on its baseline date." />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(s) => `${s.kind}-${s.id}`} gridLines="rows" storageKey="projects-slips-columns" />
      )}
    </section>
  );
}
