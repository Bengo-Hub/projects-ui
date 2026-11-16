'use client';

import { useMemo, useState } from 'react';
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/work/status-pill';
import { useCalendarTasks, useReschedule } from '@/hooks/useTasks';
import { useTaskTitles } from '@/hooks/useTaskTitles';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { TaskAccess } from '@/hooks/useTaskAccess';
import { byDueDay, dayTitle, monthGrid, monthTitle, rangeFor, sameMonth, shiftAnchor, weekGrid, ymd } from '@/lib/work/calendar';
import { conflictMessage, todayDay } from '@/lib/work/gantt';
import type { ProjectStatus, Task } from '@/types';
import { cn } from '@/lib/utils';

type View = 'month' | 'week' | 'agenda';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Chip({ task, editable, onOpen }: { task: Task; editable: boolean; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, data: { task }, disabled: !editable });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      className={cn(
        'block w-full touch-manipulation truncate rounded px-1.5 py-0.5 text-left text-xs',
        task.status === 'done' ? 'bg-success/15 text-success line-through' : 'bg-primary/10 text-foreground hover:bg-primary/20',
        isDragging && 'opacity-40',
      )}
      title={task.title}
    >
      {task.title}
    </button>
  );
}

function DayCell({ day, tasks, muted, today, access, onOpen }: { day: number; tasks: Task[]; muted: boolean; today: boolean; access: TaskAccess; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: ymd(day) });
  const shown = tasks.slice(0, 4);
  return (
    <div ref={setNodeRef} data-testid={`day-${ymd(day)}`} className={cn('min-h-24 border-b border-r border-border p-1', muted && 'bg-muted/30', isOver && 'bg-primary/10')}>
      <div className={cn('mb-1 text-right text-xs', today ? 'font-semibold text-primary' : 'text-muted-foreground')}>{new Date(day * 86_400_000).getUTCDate()}</div>
      <div className="space-y-0.5">
        {shown.map((t) => (
          <Chip key={t.id} task={t} editable={access.canEdit(t)} onOpen={onOpen} />
        ))}
        {tasks.length > shown.length && <span className="block px-1 text-[11px] text-muted-foreground">{tasks.length - shown.length} more</span>}
      </div>
    </div>
  );
}

/**
 * The calendar (US-12.6): tasks by due date. Month and week grids on wider screens with drag to
 * another day; an agenda list on phones. Only the shown window is fetched (due_from, due_to).
 */
export function CalendarView({
  orgSlug,
  projectId,
  statuses,
  access,
  onOpenTask,
}: {
  orgSlug: string;
  projectId: string;
  statuses: ProjectStatus[];
  access: TaskAccess;
  onOpenTask: (id: string) => void;
}) {
  const wide = useMediaQuery('(min-width: 640px)');
  const [chosen, setChosen] = useState<'month' | 'week'>('month');
  const view: View = wide ? chosen : 'agenda';
  const today = todayDay();
  const [anchor, setAnchor] = useState(today);
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const { tasks, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useCalendarTasks(orgSlug, projectId, range);
  const byDay = useMemo(() => byDueDay(tasks), [tasks]);
  const titleOf = useTaskTitles(orgSlug, projectId);
  const [conflict, setConflict] = useState<string | null>(null);
  const reschedule = useReschedule(orgSlug, projectId, (blocking) => setConflict(conflictMessage(blocking, titleOf)));
  const sensors = useSensors(
    // Mouse and touch apart, as on the board: PointerSensor would claim touches and lose them to
    // the browser's scroll before the long press starts.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const task = e.active.data.current?.task as Task | undefined;
    const to = e.over?.id as string | undefined;
    if (!task || !to || task.due_date?.slice(0, 10) === to) return;
    setConflict(null);
    reschedule.mutate({ id: task.id, dates: { due_date: to } });
  };

  const days = view === 'week' ? weekGrid(anchor) : monthGrid(anchor);
  const agendaDays = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" aria-label="Previous" onClick={() => setAnchor((a) => shiftAnchor(a, view, -1))}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" aria-label="Next" onClick={() => setAnchor((a) => shiftAnchor(a, view, 1))}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="ghost" className="h-11 sm:h-9" onClick={() => setAnchor(today)}>
          Today
        </Button>
        <h3 className="text-sm font-semibold" aria-live="polite">
          {view === 'week' ? `${dayTitle(days[0])} to ${dayTitle(days[6])}` : monthTitle(anchor)}
        </h3>
        {wide && (
          <div className="ml-auto flex rounded-md border border-border" role="group" aria-label="Calendar view">
            {(['month', 'week'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={chosen === v}
                onClick={() => setChosen(v)}
                className={cn('px-3 py-1.5 text-sm capitalize first:rounded-l-md last:rounded-r-md', chosen === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
      {conflict && (
        <p role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          {conflict}
        </p>
      )}
      {view === 'agenda' ? (
        isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tasks</p>
        ) : agendaDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due this month.</p>
        ) : (
          <ol className="space-y-4" data-testid="agenda">
            {agendaDays.map((d) => (
              <li key={d}>
                <h4 className={cn('mb-1 text-xs font-semibold uppercase tracking-wide', d === today ? 'text-primary' : d < today ? 'text-destructive' : 'text-muted-foreground')}>{dayTitle(d)}</h4>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {(byDay.get(d) ?? []).map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => onOpenTask(t.id)} className="flex min-h-12 w-full items-center gap-2 px-3 text-left">
                        <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                        <StatusPill status={t.status} statuses={statuses} />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="overflow-hidden rounded-md border-l border-t border-border" aria-busy={isLoading}>
            <div className="grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div key={w} className="border-b border-r border-border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
                  {w}
                </div>
              ))}
              {days.map((d) => (
                <DayCell key={d} day={d} tasks={byDay.get(d) ?? []} muted={view === 'month' && !sameMonth(d, anchor)} today={d === today} access={access} onOpen={onOpenTask} />
              ))}
            </div>
          </div>
        </DndContext>
      )}
      {hasNextPage && (
        <Button variant="outline" className="h-11 sm:h-9" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          {isFetchingNextPage ? 'Loading more' : 'Load more tasks in this range'}
        </Button>
      )}
    </div>
  );
}
