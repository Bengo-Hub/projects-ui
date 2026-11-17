// Gantt layout and critical path display (US-12.7). Pure, so node tests load it directly; it reads
// only the task fields it needs.

export interface GanttInputTask {
  id: string;
  title: string;
  status: string;
  start_date?: string;
  due_date?: string;
  critical?: boolean;
  edges?: { dependencies?: { depends_on_task_id: string; dependency_type: string }[] };
}

export type GanttZoom = 'day' | 'week' | 'month';
export const PX_PER_DAY: Record<GanttZoom, number> = { day: 36, week: 14, month: 4 };
export const ROW_HEIGHT = 36;
const DAY_MS = 86_400_000;

/** Whole days since 1970-01-01 (UTC) for a YYYY-MM-DD or RFC 3339 value; null when empty. */
export function toDay(value?: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

export function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Today in the browser's calendar, as a day number. */
export function todayDay(now: Date = new Date()): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

export interface Bar {
  id: string;
  row: number;
  start: number;
  /** Inclusive last day. */
  end: number;
  critical: boolean;
  /** Only one date was set, so the bar is a one-day marker. */
  milestone: boolean;
}

/** A bar spans start to due; with only one of them it is a one-day marker; with none, no bar. */
export function barSpan(t: GanttInputTask): { start: number; end: number; milestone: boolean } | null {
  const s = toDay(t.start_date);
  const d = toDay(t.due_date);
  if (s === null && d === null) return null;
  if (s === null || d === null) {
    const one = (s ?? d) as number;
    return { start: one, end: one, milestone: true };
  }
  return { start: Math.min(s, d), end: Math.max(s, d), milestone: false };
}

/** Rows in plan order: dated tasks by start then due, undated ones last in their API order. */
export function orderRows<T extends GanttInputTask>(tasks: T[]): T[] {
  const indexed = tasks.map((t, i) => ({ t, i, span: barSpan(t) }));
  indexed.sort((a, b) => {
    if (!a.span && !b.span) return a.i - b.i;
    if (!a.span) return 1;
    if (!b.span) return -1;
    return a.span.start - b.span.start || a.span.end - b.span.end || a.i - b.i;
  });
  return indexed.map((x) => x.t);
}

export function layoutBars(rows: GanttInputTask[]): Bar[] {
  const out: Bar[] = [];
  rows.forEach((t, row) => {
    const span = barSpan(t);
    if (span) out.push({ id: t.id, row, ...span, critical: !!t.critical });
  });
  return out;
}

/**
 * Baseline bars (sprint 16): each row's task as the baseline planned it, on the same row as its
 * live bar. Tasks the baseline did not hold, or held without dates, have none.
 */
export function baselineBars(
  rows: GanttInputTask[],
  planned: Record<string, { id: string; title: string; status: string; start_date?: string; due_date?: string }> | undefined | null,
): Bar[] {
  if (!planned) return [];
  const out: Bar[] = [];
  rows.forEach((t, row) => {
    const p = planned[t.id];
    const span = p ? barSpan(p) : null;
    if (span) out.push({ id: t.id, row, ...span, critical: false });
  });
  return out;
}

/** The days shown: a margin around every bar and today, at least four weeks. */
export function visibleRange(bars: Bar[], today: number, marginDays = 7): { from: number; to: number } {
  let from = today;
  let to = today;
  for (const b of bars) {
    if (b.start < from) from = b.start;
    if (b.end > to) to = b.end;
  }
  from -= marginDays;
  to += marginDays;
  if (to - from < 28) to = from + 28;
  return { from, to };
}

export interface Arrow {
  fromId: string;
  toId: string;
  /** Pixel points of the elbow path. */
  points: [number, number][];
  critical: boolean;
}

/**
 * Dependency arrows. FS (and the older "blocks") runs from the predecessor's end to the
 * successor's start; SS start to start, FF end to end, SF start to end.
 */
export function dependencyArrows(rows: GanttInputTask[], bars: Bar[], from: number, pxPerDay: number): Arrow[] {
  const byId = new Map(bars.map((b) => [b.id, b]));
  const crit = new Map(rows.map((t) => [t.id, !!t.critical]));
  const xStart = (b: Bar) => (b.start - from) * pxPerDay;
  const xEnd = (b: Bar) => (b.end + 1 - from) * pxPerDay;
  const yMid = (b: Bar) => b.row * ROW_HEIGHT + ROW_HEIGHT / 2;
  const out: Arrow[] = [];
  for (const t of rows) {
    const succ = byId.get(t.id);
    if (!succ) continue;
    for (const d of t.edges?.dependencies ?? []) {
      const pred = byId.get(d.depends_on_task_id);
      if (!pred) continue;
      const type = (d.dependency_type || 'FS').toUpperCase();
      const x1 = type === 'SS' || type === 'SF' ? xStart(pred) : xEnd(pred);
      const x2 = type === 'FF' || type === 'SF' ? xEnd(succ) : xStart(succ);
      const y1 = yMid(pred);
      const y2 = yMid(succ);
      const elbow = x1 + 8;
      out.push({
        fromId: pred.id,
        toId: succ.id,
        points: [
          [x1, y1],
          [elbow, y1],
          [elbow, y2],
          [x2, y2],
        ],
        critical: !!crit.get(pred.id) && !!crit.get(succ.id),
      });
    }
  }
  return out;
}

export type DragMode = 'move' | 'start' | 'end';

/**
 * The dates after dragging a bar by deltaDays. Move keeps the length; start and end resize but never
 * past the other end. A one-day marker moves whichever date it has.
 */
export function draggedDates(
  t: GanttInputTask,
  deltaDays: number,
  mode: DragMode,
): { start_date?: string; due_date?: string } | null {
  const span = barSpan(t);
  if (!span || deltaDays === 0) return null;
  const hasStart = toDay(t.start_date) !== null;
  const hasDue = toDay(t.due_date) !== null;
  if (span.milestone) {
    const day = fromDay(span.start + deltaDays);
    return hasStart ? { start_date: day } : { due_date: day };
  }
  if (mode === 'move') return { start_date: fromDay(span.start + deltaDays), due_date: fromDay(span.end + deltaDays) };
  if (mode === 'start') {
    const s = Math.min(span.start + deltaDays, span.end);
    return s === span.start ? null : { start_date: fromDay(s) };
  }
  const e = Math.max(span.end + deltaDays, span.start);
  return e === span.end || !hasDue ? null : { due_date: fromDay(e) };
}

/** What the critical path summary line says. */
export function criticalSummary(tasks: GanttInputTask[], criticalDays: number): string {
  const n = tasks.filter((t) => t.critical).length;
  if (n === 0) return 'No critical path yet: link tasks finish to start and give them dates.';
  const tasksWord = n === 1 ? 'task' : 'tasks';
  const daysWord = criticalDays === 1 ? 'day' : 'days';
  return `Critical path: ${n} ${tasksWord} over ${criticalDays} ${daysWord}. A delay to any of them delays the project.`;
}

/** The 409 schedule_conflict message, naming the tasks that block the change. */
export function conflictMessage(blockingIds: string[], titleOf: (id: string) => string | undefined): string {
  const names = blockingIds.map((id) => titleOf(id) ?? 'a task outside this view');
  if (names.length === 0) return 'That date would start this task before the tasks it waits on finish.';
  const list = names.length === 1 ? `"${names[0]}"` : `${names.slice(0, -1).map((n) => `"${n}"`).join(', ')} and "${names[names.length - 1]}"`;
  return `That date would start this task before ${list} ${names.length === 1 ? 'finishes' : 'finish'}. Move ${names.length === 1 ? 'it' : 'them'} first or pick a later date.`;
}

export interface GanttLayout {
  /** Render the chart (and its zoom buttons) at all. */
  mountChart: boolean;
  /** Render the phone list at all. */
  mountList: boolean;
  /** Classes that show the chart from the sm breakpoint, or always when asked for on a phone. */
  chartClass: string;
  /** Classes that show the list below the sm breakpoint only. */
  listClass: string;
}

/**
 * Chart on wider screens, a list on phones with the chart a tap away. wide is undefined on the
 * server and during hydration: then both render and the sm breakpoint picks in CSS, so a desktop
 * paints the chart first instead of flashing the list. Once wide is known only one stays mounted.
 */
export function ganttLayout(wide: boolean | undefined, chartOnPhone: boolean): GanttLayout {
  return {
    mountChart: wide !== false || chartOnPhone,
    mountList: wide !== true && !chartOnPhone,
    chartClass: chartOnPhone ? '' : 'hidden sm:block',
    listClass: 'sm:hidden',
  };
}

/** Tick marks for the header at a zoom: every day, each Monday, or each 1st of the month. */
export function ticks(from: number, to: number, zoom: GanttZoom): { day: number; label: string; major: boolean }[] {
  const out: { day: number; label: string; major: boolean }[] = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let d = from; d <= to; d++) {
    const date = new Date(d * DAY_MS);
    const dom = date.getUTCDate();
    const dow = date.getUTCDay();
    if (zoom === 'day') out.push({ day: d, label: String(dom), major: dom === 1 || dow === 1 });
    else if (zoom === 'week' && dow === 1) out.push({ day: d, label: `${dom} ${months[date.getUTCMonth()]}`, major: dom <= 7 });
    else if (zoom === 'month' && dom === 1) out.push({ day: d, label: `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`, major: true });
  }
  return out;
}
