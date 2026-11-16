'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { BarChart2, Info } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useGanttData } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { PageHeader } from '@/components/common/page-header';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { isNotFound } from '@/lib/api/errors';
import type { Task } from '@/types';

/** The schedule as a table for now; the timeline chart replaces it in a later sprint. */
export default function GanttPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';

  const hasGantt = useFeature('gantt_chart');

  const { data, isLoading, isError, error } = useGanttData(orgSlug, projectId, hasGantt);
  const tasks = useMemo(() => data?.data ?? [], [data]);

  const columns = useMemo<DataTableColumn<Task>[]>(() => {
    const order = new Map(tasks.map((t, i) => [t.id, i + 1]));
    const dependsOn = (t: Task) =>
      (t.edges?.dependencies ?? []).map((d) => {
        const n = order.get(d.depends_on_task_id);
        return n ? `#${n} ${d.dependency_type}` : d.dependency_type;
      });
    return [
      { key: 'n', header: '#', accessor: (t) => order.get(t.id), mobileHidden: true, cellClassName: 'w-10 text-xs text-muted-foreground' },
      { key: 'title', header: 'Task', primary: true, sortable: true, render: (t) => <span className="font-medium">{t.title}</span> },
      { key: 'status', header: 'Status', sortable: true, filterable: true, mobileAction: true, render: (t) => <Badge status={t.status} /> },
      {
        key: 'start_date',
        header: 'Start',
        sortable: true,
        render: (t) => <span className="text-xs text-muted-foreground">{formatDate(t.start_date, null, { fallback: '—' })}</span>,
      },
      {
        key: 'due_date',
        header: 'Due',
        sortable: true,
        render: (t) => <span className="text-xs text-muted-foreground">{formatDate(t.due_date, null, { fallback: '—' })}</span>,
      },
      { key: 'wbs_code', header: 'WBS', sortable: true, hideBelow: 'md', render: (t) => <span className="font-mono text-xs text-muted-foreground">{t.wbs_code ?? '—'}</span> },
      {
        key: 'dependencies',
        header: 'Depends on',
        hideBelow: 'lg',
        accessor: (t) => dependsOn(t).join(', '),
        render: (t) => {
          const deps = dependsOn(t);
          return <span className="text-xs text-muted-foreground">{deps.length > 0 ? deps.join(', ') : '—'}</span>;
        },
      },
    ];
  }, [tasks]);

  if (!hasGantt) {
    return (
      <FeatureLocked
        title="Gantt charts are a premium feature"
        description="Upgrade your plan to visualize task schedules and dependencies on a timeline."
      />
    );
  }

  if (isLoading) return <PageLoading />;
  if (isNotFound(error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (isError) return <ErrorBanner message="Failed to load Gantt data." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timeline"
        subtitle="Task schedule and dependencies"
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
      />
      {data?.truncated && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>
            This project has more than {data.limit} tasks, so the timeline shows the first {data.limit} by date created. The Tasks page
            lists every task.
          </span>
        </div>
      )}
      {tasks.length === 0 ? (
        <EmptyState icon={BarChart2} title="No tasks with schedule data" description="Add tasks with dates to see the project timeline." />
      ) : (
        <DataTable columns={columns} rows={tasks} rowKey={(t) => t.id} gridLines="rows" storageKey="projects-gantt-columns" showExportCsv exportFileName="schedule" />
      )}
    </div>
  );
}
