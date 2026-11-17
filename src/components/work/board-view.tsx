'use client';

import { memo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CloudOff, Plus } from 'lucide-react';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AssigneeAvatars } from '@/components/work/assignees';
import { TimerButton } from '@/components/time/timer';
import { useBoardColumn, useBoardCounts, useChangeStatus } from '@/hooks/useTasks';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import type { TaskAccess } from '@/hooks/useTaskAccess';
import { pendingStatus } from '@/lib/work/offline-queue';
import { readChecklist, checklistProgress } from '@/lib/work/checklist';
import type { ListTasksParams } from '@/lib/api/tasks';
import type { ProjectStatus, Task } from '@/types';
import { cn } from '@/lib/utils';

interface CardProps {
  task: Task;
  nameOf: (id: string) => string;
  queued: boolean;
  onOpen?: (id: string) => void;
  dragging?: boolean;
  overlay?: boolean;
  /** Shows the timer button (US-13.1); the drag overlay leaves it out. */
  orgSlug?: string;
}

/** A card: title, priority, due date, checklist count, assignees and the timer. Memoised for long columns. */
const TaskCard = memo(function TaskCard({ task, nameOf, queued, onOpen, dragging, overlay, orgSlug }: CardProps) {
  const list = checklistProgress(readChecklist(task.metadata));
  const overdue = !!task.due_date && task.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
  return (
    <div
      className={cn(
        'space-y-2 rounded-md border border-border bg-card p-3 text-left shadow-sm',
        dragging && 'opacity-40',
        overlay && 'rotate-1 shadow-lg ring-1 ring-primary/40',
      )}
    >
      <div className="flex items-start gap-1">
        <button type="button" onClick={() => onOpen?.(task.id)} className="block min-w-0 flex-1 break-words text-left text-sm font-medium hover:underline">
          {task.title}
        </button>
        {orgSlug && !overlay && <TimerButton orgSlug={orgSlug} task={task} compact />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={task.priority} />
        {task.due_date && <span className={cn('text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>{formatDate(task.due_date)}</span>}
        {list.total > 0 && (
          <span className="text-xs text-muted-foreground">
            {list.done}/{list.total}
          </span>
        )}
        {queued && (
          <span className="inline-flex items-center gap-1 text-xs text-warning" title="Waiting to sync">
            <CloudOff className="h-3 w-3" aria-hidden />
            Waiting to sync
          </span>
        )}
        <AssigneeAvatars assignees={task.edges?.assignees} nameOf={nameOf} className="ml-auto" />
      </div>
    </div>
  );
});

function DraggableCard(props: CardProps & { disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.task.id, data: { task: props.task }, disabled: props.disabled });
  return (
    <li ref={setNodeRef} {...attributes} {...listeners} aria-roledescription={props.disabled ? undefined : 'Draggable task'} className="touch-manipulation">
      <TaskCard {...props} dragging={isDragging} />
    </li>
  );
}

function Column({
  orgSlug,
  projectId,
  status,
  count,
  filters,
  access,
  nameOf,
  queuedIds,
  onOpenTask,
  onAdd,
}: {
  orgSlug: string;
  projectId: string;
  status: ProjectStatus;
  count?: number;
  filters: Pick<ListTasksParams, 'assignee' | 'priority'>;
  access: TaskAccess;
  nameOf: (id: string) => string;
  queuedIds: Set<string>;
  onOpenTask: (id: string) => void;
  onAdd?: (status: string) => void;
}) {
  const col = useBoardColumn(orgSlug, projectId, status.key, filters);
  const { setNodeRef, isOver } = useDroppable({ id: status.key });
  const shown = col.tasks.length;
  const total = col.data?.pages[0]?.total ?? count ?? shown;
  return (
    <section
      aria-label={`${status.label}, ${total} tasks`}
      data-testid={`column-${status.key}`}
      className="flex w-[82vw] max-w-80 shrink-0 snap-start flex-col sm:w-72"
    >
      <header className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-sm font-semibold">{status.label}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground" data-testid={`count-${status.key}`}>
          {count ?? total}
        </span>
        {onAdd && (
          <button type="button" onClick={() => onAdd(status.key)} className="ml-auto grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent" aria-label={`Add a task to ${status.label}`}>
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        )}
      </header>
      <ul
        ref={setNodeRef}
        className={cn('min-h-32 flex-1 space-y-2 rounded-md bg-muted/40 p-2 transition-colors', isOver && 'bg-primary/10 ring-1 ring-primary/30')}
      >
        {col.isLoading && [0, 1, 2].map((i) => <li key={i} className="h-20 animate-pulse rounded-md bg-muted" />)}
        {col.tasks.map((t) => (
          <DraggableCard key={t.id} orgSlug={orgSlug} task={t} nameOf={nameOf} queued={queuedIds.has(t.id)} onOpen={onOpenTask} disabled={!access.canEdit(t)} />
        ))}
        {!col.isLoading && shown === 0 && <li className="px-1 py-6 text-center text-xs text-muted-foreground">No tasks</li>}
      </ul>
      {col.hasNextPage && (
        <Button variant="ghost" className="mt-1 h-11 sm:h-9" disabled={col.isFetchingNextPage} onClick={() => void col.fetchNextPage()}>
          {col.isFetchingNextPage ? 'Loading more' : `Show more (${Math.max(0, total - shown)})`}
        </Button>
      )}
    </section>
  );
}

/**
 * The board (US-12.5): one column per project status, each paging on its own (25 at a time) so a
 * 1,000-task project stays light. Dragging a card moves it at once and rolls back on a refusal;
 * on a phone a long press starts the drag and the columns scroll sideways.
 */
export function BoardView({
  orgSlug,
  projectId,
  statuses,
  filters,
  access,
  nameOf,
  onOpenTask,
  onAdd,
}: {
  orgSlug: string;
  projectId: string;
  statuses: ProjectStatus[];
  filters: Pick<ListTasksParams, 'assignee' | 'priority'>;
  access: TaskAccess;
  nameOf: (id: string) => string;
  onOpenTask: (id: string) => void;
  onAdd?: (status: string) => void;
}) {
  const counts = useBoardCounts(orgSlug, projectId);
  const change = useChangeStatus(orgSlug, projectId);
  const queue = useOfflineQueue();
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    // Mouse and touch apart (not PointerSensor): on a phone a touch also fires pointer events, the
    // scrolling board then hands the gesture to the browser (pointercancel) and the drag dies
    // before the long press can start. TouchSensor alone owns touches: a 250 ms press, then drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const filtered = !!filters.assignee || !!filters.priority;
  const countOf = (key: string) => (filtered ? undefined : counts.data?.find((c) => c.status === key)?.count);
  const queuedIds = new Set(queue.filter((q) => q.kind === 'status' && q.projectId === projectId).map((q) => q.taskId));
  // Statuses tasks still hold but the board no longer lists (left from an earlier set) get a column too.
  const stray = (counts.data ?? []).filter((c) => c.count > 0 && !statuses.some((s) => s.key === c.status));
  const columns: ProjectStatus[] = [
    ...statuses,
    ...stray.map((c, i) => ({ key: c.status, label: c.status.replace(/_/g, ' '), category: 'todo' as const, order: 1000 + i })),
  ];

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current?.task as Task) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const task = e.active.data.current?.task as Task | undefined;
    const to = e.over?.id as string | undefined;
    if (!task || !to) return;
    const current = pendingStatus(queue, task.id) ?? task.status;
    if (to === current) return;
    change.mutate({ task: { ...task, status: current }, to });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active: a }) => `Picked up ${(a.data.current?.task as Task | undefined)?.title ?? 'task'}.`,
          onDragOver: ({ over }) => (over ? `Over ${columns.find((c) => c.key === over.id)?.label ?? over.id}.` : 'Not over a column.'),
          onDragEnd: ({ over }) => (over ? `Moved to ${columns.find((c) => c.key === over.id)?.label ?? over.id}.` : 'Dropped outside the board.'),
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:snap-none sm:px-0" data-testid="board">
        {columns.map((s) => (
          <Column
            key={s.key}
            orgSlug={orgSlug}
            projectId={projectId}
            status={s}
            count={countOf(s.key)}
            filters={filters}
            access={access}
            nameOf={nameOf}
            queuedIds={queuedIds}
            onOpenTask={onOpenTask}
            onAdd={access.canAdd ? onAdd : undefined}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <TaskCard task={active} nameOf={nameOf} queued={false} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
