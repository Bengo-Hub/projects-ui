// Calendar grid helpers (US-12.6). Pure; days are whole UTC day numbers like the Gantt helpers.

const DAY_MS = 86_400_000;

function dayOf(value?: string | null): number | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS) : null;
}

export function ymd(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function parseYmd(value?: string | null): number | null {
  return dayOf(value);
}

/** Monday of the week holding day. */
export function weekStart(day: number): number {
  const dow = new Date(day * DAY_MS).getUTCDay();
  return day - ((dow + 6) % 7);
}

/** Six Monday-first weeks covering the month of day. */
export function monthGrid(day: number): number[] {
  const d = new Date(day * DAY_MS);
  const first = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => start + i);
}

export function weekGrid(day: number): number[] {
  const start = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => start + i);
}

export function sameMonth(a: number, b: number): boolean {
  const x = new Date(a * DAY_MS);
  const y = new Date(b * DAY_MS);
  return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth();
}

/** Moves the anchor by one month or one week. */
export function shiftAnchor(day: number, view: 'month' | 'week' | 'agenda', dir: 1 | -1): number {
  if (view === 'week') return day + 7 * dir;
  const d = new Date(day * DAY_MS);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1) / DAY_MS);
}

/** The due_from and due_to of the API filter for what the view shows. */
export function rangeFor(view: 'month' | 'week' | 'agenda', anchor: number): { due_from: string; due_to: string } {
  if (view === 'week') {
    const w = weekGrid(anchor);
    return { due_from: ymd(w[0]), due_to: ymd(w[6]) };
  }
  const g = monthGrid(anchor);
  if (view === 'agenda') {
    const d = new Date(anchor * DAY_MS);
    const first = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS);
    const last = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) / DAY_MS);
    return { due_from: ymd(first), due_to: ymd(last) };
  }
  return { due_from: ymd(g[0]), due_to: ymd(g[41]) };
}

/** Tasks grouped by due day. */
export function byDueDay<T extends { due_date?: string }>(tasks: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const t of tasks) {
    const d = dayOf(t.due_date);
    if (d === null) continue;
    const list = out.get(d);
    if (list) list.push(t);
    else out.set(d, [t]);
  }
  return out;
}

export function monthTitle(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function dayTitle(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
