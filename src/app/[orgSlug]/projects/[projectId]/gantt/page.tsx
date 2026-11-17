'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { BarChart2, Info } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { useGanttData, useProjectStatuses } from '@/hooks/useTasks';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { PageHeader } from '@/components/common/page-header';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { GanttChart, GanttList } from '@/components/work/gantt-chart';
import { TaskDrawer } from '@/components/work/task-drawer';
import { LiveDot } from '@/components/work/live-dot';
import { useTaskAccess } from '@/hooks/useTaskAccess';
import { useTaskParam } from '@/hooks/useTaskParam';
import { useProjectStream } from '@/hooks/useProjectStream';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useBaselines } from '@/hooks/useBaselines';
import { isNotFound } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import { criticalSummary, ganttLayout, type GanttZoom } from '@/lib/work/gantt';
import { cn } from '@/lib/utils';
import { BaselineBar } from './baseline-bar';
import { SlipsPanel } from './slips-panel';

const ZOOMS: { key: GanttZoom; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

/** The plan on a timeline with the critical path; a list on phones, with the chart a tap away. */
export default function GanttPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const hasGantt = useFeature('gantt_chart');
  const access = useTaskAccess();
  const url = useTaskParam();
  const wide = useMediaQuery('(min-width: 640px)');
  const [chartOnPhone, setChartOnPhone] = useState(false);
  const zoom = (ZOOMS.some((z) => z.key === url.get('zoom')) ? url.get('zoom') : 'week') as GanttZoom;

  // Baselines (sprint 16): the one picked in the URL, else the latest; Slips is a second view.
  const { can } = useServicePermissions();
  const canBaselines = can(PERMS.baselinesView);
  const baselineId = url.get('baseline');
  const view = canBaselines && url.get('view') === 'slips' ? 'slips' : 'timeline';
  const baselines = useBaselines(orgSlug, projectId, hasGantt && canBaselines);

  const { data, isLoading, isError, error } = useGanttData(orgSlug, projectId, hasGantt, baselineId);
  const statuses = useProjectStatuses(orgSlug, projectId).data ?? [];
  const live = useProjectStream(orgSlug, projectId, hasGantt && access.tracking && access.canViewAll);
  const tasks = data?.data ?? [];
  const baseline = canBaselines ? (data?.baseline ?? null) : null;

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

  const layout = ganttLayout(wide, chartOnPhone);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Timeline"
        subtitle={tasks.length > 0 ? criticalSummary(tasks, data?.critical_days ?? 0) : 'Task schedule and dependencies'}
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
        actions={<LiveDot state={live} />}
      />
      {canBaselines && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Timeline or slips" className="flex gap-1 self-start rounded-lg bg-muted p-1">
            {(['timeline', 'slips'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => url.setValue('view', v === 'timeline' ? null : v)}
                className={cn('h-10 rounded-md px-4 text-sm font-medium sm:h-8', view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {v === 'timeline' ? 'Timeline' : 'Slips'}
              </button>
            ))}
          </div>
          <BaselineBar
            orgSlug={orgSlug}
            projectId={projectId}
            baselines={baselines.data ?? []}
            selected={baselineId}
            onSelect={(id) => url.setValue('baseline', id || null)}
            canAdd={can(PERMS.baselinesAdd)}
            canDelete={can(PERMS.baselinesDelete)}
          />
        </div>
      )}
      {view === 'slips' ? (
        <SlipsPanel orgSlug={orgSlug} projectId={projectId} baselineId={baselineId} statuses={statuses} />
      ) : (
        <>
          {data?.truncated && (
            <div role="status" className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <span>
                This project has more than {data.limit} tasks, so the timeline shows the first {data.limit} by date created. The Tasks page lists every task.
              </span>
            </div>
          )}
          {tasks.length === 0 ? (
            <EmptyState icon={BarChart2} title="No tasks with schedule data" description="Add tasks with dates to see the project timeline." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {layout.mountChart && (
                  <div className={cn('rounded-md border border-border p-0.5', chartOnPhone ? 'flex' : 'hidden sm:flex')} role="group" aria-label="Zoom">
                    {ZOOMS.map((z) => (
                      <button
                        key={z.key}
                        type="button"
                        aria-pressed={zoom === z.key}
                        onClick={() => url.setValue('zoom', z.key === 'week' ? null : z.key)}
                        className={cn('h-10 rounded px-3 text-sm sm:h-8', zoom === z.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
                      >
                        {z.label}
                      </button>
                    ))}
                  </div>
                )}
                {wide !== true && (
                  <Button variant="outline" className="h-10 sm:hidden" onClick={() => setChartOnPhone((v) => !v)}>
                    {chartOnPhone ? 'Show as a list' : 'Show the chart'}
                  </Button>
                )}
              </div>
              {layout.mountChart && (
                <div className={layout.chartClass} data-testid="gantt-chart-pane">
                  <GanttChart orgSlug={orgSlug} projectId={projectId} tasks={tasks} statuses={statuses} zoom={zoom} access={access} onOpenTask={(id) => url.open(id)} baseline={baseline} />
                </div>
              )}
              {layout.mountList && (
                <div className={layout.listClass} data-testid="gantt-list-pane">
                  <GanttList tasks={tasks} statuses={statuses} onOpenTask={(id) => url.open(id)} baseline={baseline} />
                </div>
              )}
            </>
          )}
        </>
      )}
      <TaskDrawer orgSlug={orgSlug} projectId={projectId} taskId={url.taskId} onClose={url.close} onOpenTask={(id) => url.open(id)} live={false} />
    </div>
  );
}
