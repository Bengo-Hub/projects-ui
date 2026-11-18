'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Columns3, List, ListPlus, Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageHeader } from '@/components/common/page-header';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { BoardView } from '@/components/work/board-view';
import { ListView } from '@/components/work/list-view';
import { CalendarView } from '@/components/work/calendar-view';
import { TaskDrawer } from '@/components/work/task-drawer';
import { CreateTaskDialog } from '@/components/work/create-task-dialog';
import { TaskBreakdownSheet } from '@/components/ai/task-breakdown-sheet';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { StatusEditor } from '@/components/work/status-editor';
import { TaskFilterBar } from '@/components/work/task-filters';
import { LiveDot } from '@/components/work/live-dot';
import { useBoardCounts, useProjectStatuses } from '@/hooks/useTasks';
import { useProjectPeople } from '@/hooks/usePeople';
import { useTaskAccess } from '@/hooks/useTaskAccess';
import { useTaskParam } from '@/hooks/useTaskParam';
import { useProjectStream } from '@/hooks/useProjectStream';
import { isNotFound } from '@/lib/api/errors';
import { loadFilters, storeFilters, type FilterState } from '@/lib/work/saved-filters';
import { cn } from '@/lib/utils';

type View = 'board' | 'list' | 'calendar';
const VIEWS: { key: View; label: string; icon: typeof List }[] = [
  { key: 'board', label: 'Board', icon: Columns3 },
  { key: 'list', label: 'List', icon: List },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
];

const NO_FILTERS: FilterState = { current: {}, saved: [] };
const noopSubscribe = () => () => {};

export default function TasksPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const url = useTaskParam();
  const view = (VIEWS.some((v) => v.key === url.get('view')) ? url.get('view') : 'board') as View;
  const access = useTaskAccess();
  const statuses = useProjectStatuses(orgSlug, projectId);
  const counts = useBoardCounts(orgSlug, projectId);
  const { people, nameOf } = useProjectPeople(orgSlug, projectId);
  const live = useProjectStream(orgSlug, projectId, access.tracking && access.canViewAll);
  const [creating, setCreating] = useState<{ status?: string } | null>(null);
  const [editingColumns, setEditingColumns] = useState(false);
  // AI task breakdown (sprint 10): drafts only, created through the ordinary task create.
  const { can } = useServicePermissions();
  const canDraft = access.canAdd && can(PERMS.aiAdd);
  const [drafting, setDrafting] = useState(false);
  // Saved filters live in this browser: the server render and the first client render use none
  // (so hydration matches), then the browser's copy; changes are kept per project.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const stored = useMemo(() => (isClient ? loadFilters(projectId) : NO_FILTERS), [isClient, projectId]);
  const [edited, setEdited] = useState<{ projectId: string; value: FilterState } | null>(null);
  const filters = edited?.projectId === projectId ? edited.value : stored;
  const updateFilters = (next: FilterState) => {
    setEdited({ projectId, value: next });
    storeFilters(projectId, next);
  };

  if (!access.isLoading && !access.tracking) {
    return <FeatureLocked title="Task tracking is not on your plan" description="Upgrade your plan to plan and track tasks on boards, lists and calendars." />;
  }
  if (statuses.isLoading) return <PageLoading />;
  if (isNotFound(statuses.error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (statuses.isError) return <ErrorBanner message="Failed to load the board." />;

  const columns = statuses.data ?? [];
  const total = (counts.data ?? []).reduce((n, c) => n + c.count, 0);
  // The board shows every column, so only the assignee and priority filters apply to it.
  const boardFilters = { assignee: filters.current.assignee, priority: filters.current.priority };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        subtitle={counts.data ? `${total} ${total === 1 ? 'task' : 'tasks'}` : undefined}
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
        actions={
          <>
            <LiveDot state={live} />
            {access.canManageStatuses && view === 'board' && (
              <Button variant="outline" size="sm" className="h-11 sm:h-8" onClick={() => setEditingColumns(true)}>
                <Settings2 className="h-4 w-4" aria-hidden />
                <span className="max-sm:sr-only">Columns</span>
              </Button>
            )}
            {canDraft && (
              <Button variant="outline" size="sm" className="h-11 sm:h-8" onClick={() => setDrafting(true)}>
                <ListPlus className="h-4 w-4" aria-hidden />
                <span className="max-sm:sr-only">Draft from brief</span>
              </Button>
            )}
            {access.canAdd && (
              <Button size="sm" className="h-11 sm:h-8" onClick={() => setCreating({})}>
                <Plus className="h-4 w-4" aria-hidden />
                Add task
              </Button>
            )}
          </>
        }
      />

      <div className="flex rounded-md border border-border p-0.5 sm:inline-flex" role="tablist" aria-label="Task views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => url.setValue('view', v.key === 'board' ? null : v.key)}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded px-3 text-sm sm:h-8 sm:flex-none',
              view === v.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <v.icon className="h-4 w-4" aria-hidden />
            {v.label}
          </button>
        ))}
      </div>

      {view !== 'calendar' && <TaskFilterBar state={filters} onChange={updateFilters} statuses={columns} people={people} showStatus={view === 'list'} />}

      {view === 'board' && (
        <BoardView
          orgSlug={orgSlug}
          projectId={projectId}
          statuses={columns}
          filters={boardFilters}
          access={access}
          nameOf={nameOf}
          onOpenTask={(id) => url.open(id)}
          onAdd={(status) => setCreating({ status })}
        />
      )}
      {view === 'list' && <ListView orgSlug={orgSlug} projectId={projectId} filters={filters.current} statuses={columns} nameOf={nameOf} onOpenTask={(id) => url.open(id)} />}
      {view === 'calendar' && <CalendarView orgSlug={orgSlug} projectId={projectId} statuses={columns} access={access} onOpenTask={(id) => url.open(id)} />}

      {creating && (
        <CreateTaskDialog orgSlug={orgSlug} projectId={projectId} open onOpenChange={(o) => !o && setCreating(null)} initial={creating.status ? { status: creating.status } : undefined} />
      )}
      {canDraft && <TaskBreakdownSheet orgSlug={orgSlug} projectId={projectId} open={drafting} onOpenChange={setDrafting} />}
      {editingColumns && (
        <StatusEditor orgSlug={orgSlug} projectId={projectId} statuses={columns} counts={counts.data ?? []} open onOpenChange={(o) => !o && setEditingColumns(false)} />
      )}
      <TaskDrawer orgSlug={orgSlug} projectId={projectId} taskId={url.taskId} onClose={url.close} onOpenTask={(id) => url.open(id)} live={false} />
    </div>
  );
}
