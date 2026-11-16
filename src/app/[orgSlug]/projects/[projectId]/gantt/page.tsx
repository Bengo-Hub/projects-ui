'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { BarChart2 } from 'lucide-react';
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
import type { GanttTask } from '@/types';

/** The schedule as a table for now; the timeline chart replaces it in a later sprint. */
export default function GanttPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';

  const hasGantt = useFeature('gantt_chart');

  const { data: tasks, isLoading, isError } = useGanttData(orgSlug, projectId);

  const columns = useMemo<DataTableColumn<GanttTask>[]>(() => {
    const order = new Map((tasks ?? []).map((t, i) => [t.id, i + 1]));
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
        key: 'end',
        header: 'End or due',
        sortable: true,
        accessor: (t) => t.end_date ?? t.due_date,
        render: (t) => <span className="text-xs text-muted-foreground">{formatDate(t.end_date ?? t.due_date, null, { fallback: '—' })}</span>,
      },
      { key: 'wbs_code', header: 'WBS', sortable: true, hideBelow: 'md', render: (t) => <span className="font-mono text-xs text-muted-foreground">{t.wbs_code ?? '—'}</span> },
      {
        key: 'dependencies',
        header: 'Depends on',
        hideBelow: 'lg',
        accessor: (t) => t.dependencies.join(', '),
        render: (t) => <span className="text-xs text-muted-foreground">{t.dependencies.length > 0 ? t.dependencies.join(', ') : '—'}</span>,
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
  if (isError) return <ErrorBanner message="Failed to load Gantt data." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timeline"
        subtitle="Task schedule and dependencies"
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
      />
      {!tasks || tasks.length === 0 ? (
        <EmptyState icon={BarChart2} title="No tasks with schedule data" description="Add tasks with dates to see the project timeline." />
      ) : (
        <DataTable columns={columns} rows={tasks} rowKey={(t) => t.id} gridLines="rows" storageKey="projects-gantt-columns" showExportCsv exportFileName="schedule" />
      )}
    </div>
  );
}
