// Workload rules the screens share (sprint 16). No React, no aliases and no runtime imports, so
// node-tests can load this file directly.

export type HeatBand = 'none' | 'light' | 'medium' | 'high' | 'full' | 'over';

/**
 * The colour band of one person-week. projects-api marks a week overloaded above 100 percent, and
 * any demand against zero capacity is overloaded too, so the band follows its flag first.
 */
export function heatBand(loadPct: number, overloaded: boolean, demandHours = loadPct): HeatBand {
  if (overloaded) return 'over';
  if (!(demandHours > 0) && !(loadPct > 0)) return 'none';
  if (loadPct < 50) return 'light';
  if (loadPct < 80) return 'medium';
  if (loadPct < 95) return 'high';
  return 'full';
}

/** Theme token classes per band; overloaded weeks also carry a text marker for colour blind readers. */
export const HEAT_CLASS: Record<HeatBand, string> = {
  none: 'bg-muted/40 text-muted-foreground',
  light: 'bg-success/10 text-foreground',
  medium: 'bg-success/25 text-foreground',
  high: 'bg-warning/20 text-foreground',
  full: 'bg-warning/35 text-foreground',
  over: 'bg-destructive/20 text-destructive font-semibold ring-1 ring-inset ring-destructive/50',
};

export const HEAT_LABEL: Record<HeatBand, string> = {
  none: 'Free',
  light: 'Under 50%',
  medium: '50 to 79%',
  high: '80 to 94%',
  full: '95 to 100%',
  over: 'Over capacity',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymdUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** The ISO week number of a date (weeks start on Monday; week 1 holds the first Thursday). */
export function isoWeek(weekStart: string): number {
  const d = parseYmd(weekStart);
  if (!d) return 0;
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** "W47, 16 Nov" for the column head; the day is the week's Monday. */
export function weekLabel(weekStart: string): string {
  const d = parseYmd(weekStart);
  if (!d) return weekStart;
  return `W${isoWeek(weekStart)}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The Monday on or before a YYYY-MM-DD date (the API moves from to its Monday the same way). */
export function mondayOf(ymd: string): string {
  const d = parseYmd(ymd);
  if (!d) return ymd;
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return ymdUTC(d);
}

/** A date moved by whole weeks. */
export function addWeeks(ymd: string, weeks: number): string {
  const d = parseYmd(ymd);
  if (!d) return ymd;
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return ymdUTC(d);
}

/** This week's Monday in the browser's calendar. */
export function thisMonday(now: Date = new Date()): string {
  return mondayOf(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

/** Hours to one decimal, without a trailing .0. */
export function hoursText(h: number): string {
  const r = Math.round((Number.isFinite(h) ? h : 0) * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)} h`;
}

/** What a cell says: the load as a percent, or the hours when there is no capacity. */
export function cellText(w: { demand_hours: number; capacity_hours: number; load_pct: number }): string {
  if (!(w.demand_hours > 0)) return '-';
  if (!(w.capacity_hours > 0)) return hoursText(w.demand_hours);
  return `${Math.round(w.load_pct)}%`;
}

/** Weekly hours the API takes: 0 to 168. */
export function validHours(v: string): boolean {
  const s = v.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return false;
  const n = Number(s);
  return n >= 0 && n <= 168;
}

/**
 * The assignees after moving a task from one person to another: the new person takes the old one's
 * place (a primary stays primary), the others stay. From "unassigned" the new person is added; a
 * new person already on the task is not listed twice.
 */
export function reassignedIds(current: string[], from: string, to: string): string[] {
  if (!to) return current;
  const out: string[] = [];
  let placed = false;
  for (const id of current) {
    if (id === from) {
      if (!out.includes(to)) out.push(to);
      placed = true;
    } else if (!out.includes(id) && id !== to) out.push(id);
    else if (id === to && !out.includes(to)) out.push(to);
  }
  if (!placed && !out.includes(to)) out.push(to);
  return out;
}

/** The weeks query value: 1 to 26 (the API's bounds), default 8. */
export function clampWeeks(n: number): number {
  if (!Number.isFinite(n)) return 8;
  return Math.min(26, Math.max(1, Math.round(n)));
}
