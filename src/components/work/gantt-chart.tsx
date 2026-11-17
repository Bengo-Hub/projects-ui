'use client';

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { StatusPill } from '@/components/work/status-pill';
import { useReschedule } from '@/hooks/useTasks';
import type { TaskAccess } from '@/hooks/useTaskAccess';
import {
  PX_PER_DAY,
  ROW_HEIGHT,
  baselineBars,
  conflictMessage,
  dependencyArrows,
  draggedDates,
  layoutBars,
  orderRows,
  ticks,
  todayDay,
  visibleRange,
  type DragMode,
  type GanttZoom,
} from '@/lib/work/gantt';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import type { GanttTask, ProjectStatus } from '@/types';
import type { GanttBaseline } from '@/lib/api/planning';
import { cn } from '@/lib/utils';

const LABEL_W = 220;
const HEADER_H = 40;
const OVERSCAN = 10;
const EDGE_PX = 8;

interface Drag {
  id: string;
  mode: DragMode;
  startX: number;
  dx: number;
  moved: boolean;
}

/**
 * The Gantt chart (US-12.7): bars from start to due, dependency arrows, the critical path in red,
 * a today line and three zooms. Bars the user may change drag to move, or resize from either end;
 * a broken finish-to-start link comes back as a 409 naming the blocking tasks. Only the rows in
 * view are drawn, so 2,000 tasks stay smooth.
 */
export function GanttChart({
  orgSlug,
  projectId,
  tasks,
  statuses,
  zoom,
  access,
  onOpenTask,
  baseline,
}: {
  orgSlug: string;
  projectId: string;
  tasks: GanttTask[];
  statuses: ProjectStatus[];
  zoom: GanttZoom;
  access: TaskAccess;
  onOpenTask: (id: string) => void;
  /** Sprint 16: a saved baseline, drawn as a thin bar under each live bar. */
  baseline?: GanttBaseline | null;
}) {
  const rows = useMemo(() => orderRows(tasks), [tasks]);
  const bars = useMemo(() => layoutBars(rows), [rows]);
  const planned = useMemo(() => baselineBars(rows, baseline?.tasks), [rows, baseline]);
  const today = todayDay();
  const { from, to } = useMemo(() => visibleRange([...bars, ...planned], today), [bars, planned, today]);
  const px = PX_PER_DAY[zoom];
  const chartW = (to - from + 1) * px;
  const bodyH = rows.length * ROW_HEIGHT;
  const arrows = useMemo(() => dependencyArrows(rows, bars, from, px), [rows, bars, from, px]);
  const tickMarks = useMemo(() => ticks(from, to, zoom), [from, to, zoom]);
  const byId = useMemo(() => new Map(rows.map((t) => [t.id, t])), [rows]);

  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(rows.length - 1, Math.ceil((scrollTop + viewH) / ROW_HEIGHT) + OVERSCAN);

  const [conflict, setConflict] = useState<string | null>(null);
  const reschedule = useReschedule(orgSlug, projectId, (blocking) => setConflict(conflictMessage(blocking, (id) => byId.get(id)?.title)));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<{ id: string; dx: number; mode: DragMode } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<SVGRectElement>, id: string, editable: boolean) => {
    if (!editable) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mode: DragMode = rect.width > EDGE_PX * 3 && x < EDGE_PX ? 'start' : rect.width > EDGE_PX * 3 && x > rect.width - EDGE_PX ? 'end' : 'move';
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, mode, startX: e.clientX, dx: 0, moved: false });
  };
  const onPointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    setDrag({ ...drag, dx, moved: drag.moved || Math.abs(dx) > 4 });
  };
  const onPointerUp = (id: string) => {
    const d = drag;
    setDrag(null);
    if (!d || !d.moved) {
      onOpenTask(id);
      return;
    }
    const task = byId.get(id);
    const days = Math.round(d.dx / px);
    const dates = task ? draggedDates(task, days, d.mode) : null;
    if (!task || !dates) return;
    setConflict(null);
    setPending({ id, dx: days * px, mode: d.mode });
    reschedule.mutate({ id, dates }, { onSettled: () => setPending(null) });
  };

  const offsetFor = (id: string): { dx: number; mode: DragMode } | null => {
    if (drag?.id === id && drag.moved) return { dx: Math.round(drag.dx / px) * px, mode: drag.mode };
    if (pending?.id === id) return pending;
    return null;
  };

  const visibleIds = new Set(rows.slice(first, last + 1).map((t) => t.id));
  const todayX = (today - from) * px;

  return (
    <div className="space-y-2">
      {conflict && (
        <p role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          {conflict}
        </p>
      )}
      <div
        ref={(el) => {
          scroller.current = el;
          if (el && el.clientHeight && el.clientHeight !== viewH) setViewH(el.clientHeight);
        }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="relative max-h-[70vh] overflow-auto overscroll-contain rounded-md border border-border bg-card"
        data-testid="gantt"
      >
        <div style={{ width: LABEL_W + chartW, height: HEADER_H + bodyH }} className="relative">
          <div className="sticky top-0 z-20 flex border-b border-border bg-card" style={{ height: HEADER_H }}>
            <div className="sticky left-0 z-30 flex items-center border-r border-border bg-card px-3 text-xs font-medium text-muted-foreground" style={{ width: LABEL_W, minWidth: LABEL_W }}>
              Task
            </div>
            <svg width={chartW} height={HEADER_H} aria-hidden className="shrink-0">
              {tickMarks.map((t) => (
                <g key={t.day} transform={`translate(${(t.day - from) * px},0)`}>
                  <line y1={HEADER_H - 8} y2={HEADER_H} className="stroke-border" />
                  <text x={4} y={HEADER_H - 14} className={cn('fill-muted-foreground text-[10px]', t.major && 'font-semibold')}>
                    {t.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="relative flex" style={{ height: bodyH }}>
            <ol className="sticky left-0 z-10 border-r border-border bg-card" style={{ width: LABEL_W, minWidth: LABEL_W, height: bodyH }} aria-label="Tasks">
              {rows.slice(first, last + 1).map((t, i) => (
                <li key={t.id} className="absolute inset-x-0 flex items-center border-b border-border/50 px-3" style={{ top: (first + i) * ROW_HEIGHT, height: ROW_HEIGHT }}>
                  <button type="button" onClick={() => onOpenTask(t.id)} className={cn('min-w-0 truncate text-left text-sm hover:underline', t.critical && 'font-medium text-destructive')} title={t.title}>
                    {t.title}
                  </button>
                </li>
              ))}
            </ol>
            <svg width={chartW} height={bodyH} className="shrink-0" role="img" aria-label={`Timeline of ${rows.length} tasks`}>
              <defs>
                <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground" />
                </marker>
                <marker id="gantt-arrow-critical" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" className="fill-destructive" />
                </marker>
              </defs>
              {tickMarks.map((t) => (
                <line key={t.day} x1={(t.day - from) * px} x2={(t.day - from) * px} y1={0} y2={bodyH} className={t.major ? 'stroke-border' : 'stroke-border/40'} />
              ))}
              {arrows
                .filter((a) => visibleIds.has(a.fromId) || visibleIds.has(a.toId))
                .map((a) => (
                  <polyline
                    key={`${a.fromId}-${a.toId}`}
                    points={a.points.map((p) => p.join(',')).join(' ')}
                    fill="none"
                    strokeWidth={a.critical ? 1.75 : 1}
                    className={a.critical ? 'stroke-destructive' : 'stroke-muted-foreground/60'}
                    markerEnd={`url(#${a.critical ? 'gantt-arrow-critical' : 'gantt-arrow'})`}
                  />
                ))}
              {planned
                .filter((b) => b.row >= first && b.row <= last)
                .map((b) => (
                  <rect
                    key={`baseline-${b.id}`}
                    x={(b.start - from) * px}
                    y={b.row * ROW_HEIGHT + ROW_HEIGHT - 7}
                    width={Math.max(px, (b.end - b.start + 1) * px)}
                    height={4}
                    rx={2}
                    className="pointer-events-none fill-muted-foreground/50"
                    data-testid={`baseline-bar-${b.id}`}
                  />
                ))}
              {bars
                .filter((b) => b.row >= first && b.row <= last)
                .map((b) => {
                  const t = byId.get(b.id)!;
                  const editable = access.canEdit(t);
                  const off = offsetFor(b.id);
                  let x = (b.start - from) * px;
                  let w = Math.max(px, (b.end - b.start + 1) * px);
                  if (off) {
                    if (off.mode === 'move') x += off.dx;
                    else if (off.mode === 'start') {
                      x += Math.min(off.dx, w - px);
                      w -= Math.min(off.dx, w - px);
                    } else w = Math.max(px, w + off.dx);
                  }
                  const y = b.row * ROW_HEIGHT + 8;
                  const done = t.status === 'done';
                  return (
                    <g key={b.id} data-testid={`bar-${b.id}`} data-critical={b.critical ? 'true' : 'false'}>
                      <rect
                        x={x}
                        y={y}
                        width={b.milestone ? Math.max(10, px) : w}
                        height={ROW_HEIGHT - 16}
                        rx={b.milestone ? 2 : 4}
                        className={cn(
                          b.critical ? 'fill-destructive/80' : done ? 'fill-success/60' : 'fill-primary/70',
                          editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                          off && 'opacity-70',
                        )}
                        style={{ touchAction: editable ? 'none' : 'auto' }}
                        onPointerDown={(e) => onPointerDown(e, b.id, editable)}
                        onPointerMove={onPointerMove}
                        onPointerUp={() => (drag ? onPointerUp(b.id) : onOpenTask(b.id))}
                        onPointerCancel={() => setDrag(null)}
                      >
                        <title>
                          {t.title}
                          {b.critical ? ' (critical)' : ''}
                        </title>
                      </rect>
                    </g>
                  );
                })}
              {todayX >= 0 && todayX <= chartW && <line x1={todayX} x2={todayX} y1={0} y2={bodyH} strokeDasharray="4 3" className="stroke-warning" strokeWidth={1.5} data-testid="today-line" />}
            </svg>
          </div>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-destructive/80" aria-hidden /> Critical path
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-primary/70" aria-hidden /> Other tasks
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0 border-l-2 border-dashed border-warning" aria-hidden /> Today
        </span>
        {baseline && (
          <span className="inline-flex items-center gap-1.5" data-testid="baseline-legend">
            <span className="h-1 w-4 rounded-sm bg-muted-foreground/50" aria-hidden /> Baseline: {baseline.name}
          </span>
        )}
        {rows.some((t) => access.canEdit(t)) && <span>Drag a bar to move it, or its ends to change the dates.</span>}
      </p>
    </div>
  );
}

/** Below 640 px: the plan as a list (dates, status, critical), each opening the drawer. */
export function GanttList({
  tasks,
  statuses,
  onOpenTask,
  baseline,
}: {
  tasks: GanttTask[];
  statuses: ProjectStatus[];
  onOpenTask: (id: string) => void;
  baseline?: GanttBaseline | null;
}) {
  const rows = useMemo(() => orderRows(tasks), [tasks]);
  return (
    <ul className="divide-y divide-border rounded-md border border-border" data-testid="gantt-list">
      {rows.map((t) => (
        <li key={t.id}>
          <button type="button" onClick={() => onOpenTask(t.id)} className="flex min-h-14 w-full flex-col gap-1 px-3 py-2 text-left">
            <span className="flex w-full items-center gap-2">
              <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', t.critical && 'text-destructive')}>{t.title}</span>
              <StatusPill status={t.status} statuses={statuses} />
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(t.start_date, null, { fallback: 'No start' })} to {formatDate(t.due_date, null, { fallback: 'no due date' })}
              {t.critical && <span className="ml-2 font-medium text-destructive">Critical</span>}
            </span>
            {baseline?.tasks?.[t.id] && (
              <span className="text-xs text-muted-foreground" data-testid="baseline-dates">
                Baseline {formatDate(baseline.tasks[t.id].start_date, null, { fallback: 'no start' })} to {formatDate(baseline.tasks[t.id].due_date, null, { fallback: 'no due date' })}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
