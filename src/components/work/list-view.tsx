'use client';

import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { Badge } from '@/components/ui/badge';
import { ShowMore } from '@/components/common/list-parts';
import { TimerButton } from '@/components/time/timer';
import { RepeatIcon } from '@/components/planning/repeat-control';
import { AssigneeAvatars } from '@/components/work/assignees';
import { StatusPill, statusLabel } from '@/components/work/status-pill';
import { useTasks } from '@/hooks/useTasks';
import type { TaskFilters } from '@/lib/work/saved-filters';
import type { ProjectStatus, Task } from '@/types';

/** The list view (US-12.6) on the shared data table; filters run on the server, 100 rows a page. */
export function ListView({
  orgSlug,
  projectId,
  filters,
  statuses,
  nameOf,
  onOpenTask,
}: {
  orgSlug: string;
  projectId: string;
  filters: TaskFilters;
  statuses: ProjectStatus[];
  nameOf: (id: string) => string;
  onOpenTask: (id: string) => void;
}) {
  const { tasks, total, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useTasks(orgSlug, projectId, filters);

  const columns = useMemo<DataTableColumn<Task>[]>(
    () => [
      {
        key: 'title',
        header: 'Title',
        primary: true,
        sortable: true,
        accessor: (t) => t.title,
        render: (t) => (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium">{t.title}</span>
            <RepeatIcon metadata={t.metadata} />
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        mobileAction: true,
        accessor: (t) => statusLabel(statuses, t.status),
        render: (t) => <StatusPill status={t.status} statuses={statuses} />,
      },
      { key: 'priority', header: 'Priority', sortable: true, render: (t) => <Badge status={t.priority} /> },
      {
        key: 'assignees',
        header: 'Assignees',
        accessor: (t) => (t.edges?.assignees ?? []).map((a) => nameOf(a.user_id)).join(', '),
        render: (t) => <AssigneeAvatars assignees={t.edges?.assignees} nameOf={nameOf} />,
      },
      {
        key: 'due_date',
        header: 'Due',
        sortable: true,
        accessor: (t) => t.due_date,
        render: (t) => <span className="text-muted-foreground">{formatDate(t.due_date, null, { fallback: 'None' })}</span>,
      },
      {
        key: 'progress_pct',
        header: 'Progress',
        align: 'right',
        hideBelow: 'lg',
        accessor: (t) => t.progress_pct ?? 0,
        render: (t) => <span className="tabular-nums text-muted-foreground">{t.progress_pct ?? 0}%</span>,
      },
      {
        key: 'timer',
        header: <span className="sr-only">Timer</span>,
        exportable: false,
        mobileAction: true,
        align: 'right',
        // The row opens the drawer on click; the timer press must not.
        render: (t) => (
          <span onClick={(e) => e.stopPropagation()} className="inline-flex">
            <TimerButton orgSlug={orgSlug} task={t} compact />
          </span>
        ),
      },
    ],
    [statuses, nameOf, orgSlug],
  );

  return (
    <div className="grid gap-3">
      {total > tasks.length && (
        <p className="text-xs text-muted-foreground">
          {tasks.length} of {total} shown
        </p>
      )}
      <DataTable
        columns={columns}
        rows={tasks}
        rowKey={(t) => t.id}
        loading={isLoading}
        loadingRows={6}
        error={isError}
        onRetry={() => void refetch()}
        emptyText="No tasks match these filters."
        onRowClick={(t) => onOpenTask(t.id)}
        gridLines="rows"
        storageKey="projects-tasks-columns"
        showExportCsv
        exportFileName="tasks"
      />
      <ShowMore show={!!hasNextPage} loading={isFetchingNextPage} onClick={() => void fetchNextPage()} />
    </div>
  );
}
