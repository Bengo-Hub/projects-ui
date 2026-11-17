// Time tracking (sprint 13): week maths, hours, totals, the running timer and the offline stop.
// Pure: no React, no aliases and no runtime imports, so node-tests can load this file directly.
// The hours live in the user's ERP timesheet; projects-api's /time routes read and write them.

/** A week row: one project (and task) with its hours per date. */
export interface TimeRow {
  project_id: string | null;
  project_name?: string;
  task_id?: string | null;
  task_title?: string;
  billable: boolean;
  hours: Record<string, number>;
  notes?: Record<string, string>;
  total: number;
}

export type WeekStatus = 'none' | 'draft' | 'submitted' | 'approved' | 'rejected' | 'mixed';

export interface TimeSheet {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  rejection_reason?: string;
  editable: boolean;
}

/** GET /time/week. */
export interface TimeWeek {
  week_start: string;
  week_end: string;
  days: string[];
  status: WeekStatus;
  editable: boolean;
  timesheets: TimeSheet[];
  rows: TimeRow[];
  day_totals: Record<string, number>;
  total: number;
  billable_total: number;
}

/** PUT /time/entries: sets one day's hours on a project and task. */
export interface TimeEntryInput {
  project_id: string;
  task_id?: string;
  date: string;
  hours: number;
  note?: string;
  billable?: boolean;
  /** Logs for someone else (projects.time.manage). */
  user_id?: string;
}

/** POST /time/timer/stop: a finished run with the browser's own start and stop. */
export interface TimerStopInput {
  project_id: string;
  task_id?: string;
  started_at: string;
  stopped_at: string;
  note?: string;
  billable?: boolean;
}

/**
 * The Idempotency-Key of a timer stop: fixed per run (its task, or project, and its start), so a
 * replay or a second device stopping the same run is logged once. A retry after a stop that
 * crossed midnight moves started_at to the next local midnight, so it gets its own key and logs
 * the rest of the run.
 */
export function timerStopKey(stop: Pick<TimerStopInput, 'project_id' | 'task_id' | 'started_at'>): string {
  return `stop:${stop.task_id ?? stop.project_id}:${new Date(stop.started_at).toISOString()}`;
}

/** The user's running timer (GET /time/timer). */
export interface RunningTimer {
  project_id: string;
  task_id: string;
  task_title: string;
  started_at: string;
}

export interface TimeSegment {
  date: string;
  hours: number;
}

// ---- Dates (YYYY-MM-DD strings, calendar maths in UTC so no zone shifts a day) ----

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(s: unknown): s is string {
  return typeof s === 'string' && YMD.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = parseYmd(date);
  d.setUTCDate(d.getUTCDate() + n);
  return toYmd(d);
}

/** The Monday of the week holding date (weeks run Monday to Sunday, as ERP's timesheets). */
export function mondayOf(date: string): string {
  const d = parseYmd(date);
  const back = (d.getUTCDay() + 6) % 7;
  return addDays(date, -back);
}

/** The seven dates of the week starting on a Monday. */
export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const dayLongFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Mon 17" for a grid column; long: "Monday 17 Nov". */
export function dayName(date: string, long = false): string {
  return (long ? dayLongFmt : dayFmt).format(parseYmd(date)).replace(',', '');
}

/** "17 Nov to 23 Nov 2026" for a week starting on a Monday. */
export function weekLabel(start: string): string {
  const end = addDays(start, 6);
  return `${dayMonthFmt.format(parseYmd(start))} to ${dayMonthFmt.format(parseYmd(end))} ${end.slice(0, 4)}`;
}

/** Today's date in an IANA zone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The offset of an IANA zone from UTC at an instant, in milliseconds. */
function zoneOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a date starts (local midnight) in an IANA zone. */
export function zonedMidnight(date: string, tz: string): Date {
  const guess = parseYmd(date).getTime();
  // Twice, so a zone that changes its offset that night still lands on its own midnight.
  let t = guess - zoneOffsetMs(new Date(guess), tz);
  t = guess - zoneOffsetMs(new Date(t), tz);
  return new Date(t);
}

// ---- Hours ----

export const MAX_DAY_HOURS = 24;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Reads what someone typed in a cell: decimals ("1.5", "1,5") or hours and minutes ("1:30").
 * Empty means zero. Answers the hours rounded to two places, or a message.
 */
export function parseHours(raw: string): { ok: true; hours: number } | { ok: false; message: string } {
  const s = raw.trim();
  if (s === '') return { ok: true, hours: 0 };
  let hours: number;
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  if (clock) {
    hours = Number(clock[1]) + Number(clock[2]) / 60;
  } else if (/^\d{0,2}([.,]\d{0,2})?$/.test(s) && /\d/.test(s)) {
    hours = Number(s.replace(',', '.'));
  } else {
    return { ok: false, message: 'Type hours as 1.5 or 1:30.' };
  }
  if (!Number.isFinite(hours) || hours < 0 || hours > MAX_DAY_HOURS) return { ok: false, message: 'A day holds 0 to 24 hours.' };
  return { ok: true, hours: round2(hours) };
}

/** Hours for a cell: blank for none, else up to two places ("1.5", "8", "0.25"). */
export function formatHours(h: number | undefined | null): string {
  if (!h) return '';
  return String(round2(h));
}

/** Hours for a total: "0" when none. */
export function formatTotal(h: number | undefined | null): string {
  return h ? String(round2(h)) : '0';
}

/** A running timer's elapsed time: "m:ss" under an hour, "h:mm:ss" from one hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Milliseconds a timer has run at now; zero for a start the browser cannot read. */
export function elapsedMs(startedAt: string, now: number): number {
  const t = Date.parse(startedAt);
  return Number.isNaN(t) ? 0 : Math.max(0, now - t);
}

// ---- Rows and totals ----

export function rowKey(projectId: string | null | undefined, taskId?: string | null): string {
  return `${projectId ?? ''}:${taskId ?? ''}`;
}

function rowTotal(hours: Record<string, number>, days: string[]): number {
  return round2(days.reduce((sum, d) => sum + (hours[d] ?? 0), 0));
}

/** Day totals, the week total and the billable total over rows, as the API counts them. */
export function weekTotals(rows: TimeRow[], days: string[]): Pick<TimeWeek, 'day_totals' | 'total' | 'billable_total'> {
  const day_totals: Record<string, number> = {};
  let total = 0;
  let billable_total = 0;
  for (const d of days) day_totals[d] = 0;
  for (const r of rows) {
    for (const d of days) {
      const h = r.hours[d] ?? 0;
      day_totals[d] = round2(day_totals[d] + h);
      total += h;
      if (r.billable) billable_total += h;
    }
  }
  return { day_totals, total: round2(total), billable_total: round2(billable_total) };
}

/** Names for a row that is not on the week yet (a new row, or an entry made offline). */
export interface RowNames {
  project_name?: string;
  task_title?: string;
}

/**
 * The week with one entry applied: the day's hours (and note and billable flag when given) on the
 * project and task's row, adding the row when it is new, with every total recounted. Used for the
 * optimistic edit and to show entries still waiting in the offline queue.
 */
export function applyEntry(week: TimeWeek, e: Pick<TimeEntryInput, 'project_id' | 'task_id' | 'date' | 'hours' | 'note' | 'billable'>, names: RowNames = {}): TimeWeek {
  if (!week.days.includes(e.date)) return week;
  const key = rowKey(e.project_id, e.task_id);
  let found = false;
  const rows = week.rows.map((r) => {
    if (rowKey(r.project_id, r.task_id) !== key) return r;
    found = true;
    return patchRow(r, e, week.days);
  });
  if (!found) {
    const fresh: TimeRow = {
      project_id: e.project_id,
      project_name: names.project_name,
      task_id: e.task_id ?? null,
      task_title: names.task_title,
      billable: e.billable ?? false,
      hours: {},
      total: 0,
    };
    rows.push(patchRow(fresh, e, week.days));
  }
  return { ...week, rows, ...weekTotals(rows, week.days) };
}

function patchRow(r: TimeRow, e: Pick<TimeEntryInput, 'date' | 'hours' | 'note' | 'billable'>, days: string[]): TimeRow {
  const hours = { ...r.hours, [e.date]: round2(e.hours) };
  let notes = r.notes;
  if (e.note !== undefined) {
    notes = { ...(r.notes ?? {}) };
    if (e.note.trim()) notes[e.date] = e.note.trim();
    else delete notes[e.date];
  }
  return { ...r, hours, notes, billable: e.billable ?? r.billable, total: rowTotal(hours, days) };
}

/** Rows added on the page but not saved yet, after the week's own rows (none repeated). */
export function withDraftRows(week: TimeWeek, drafts: TimeRow[]): TimeWeek {
  const have = new Set(week.rows.map((r) => rowKey(r.project_id, r.task_id)));
  const extra = drafts.filter((d) => !have.has(rowKey(d.project_id, d.task_id)));
  return extra.length ? { ...week, rows: [...week.rows, ...extra] } : week;
}

/** An empty row for the add row picker. */
export function draftRow(projectId: string, projectName: string, billable: boolean, taskId?: string, taskTitle?: string): TimeRow {
  return { project_id: projectId, project_name: projectName, task_id: taskId ?? null, task_title: taskTitle, billable, hours: {}, total: 0 };
}

/** The days of a row that hold hours (a billable switch re-sends exactly these). */
export function loggedDays(r: TimeRow, days: string[]): string[] {
  return days.filter((d) => (r.hours[d] ?? 0) > 0);
}

// ---- Status and billing ----

export const WEEK_STATUS_LABEL: Record<WeekStatus, string> = {
  none: 'Nothing logged',
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  mixed: 'Partly submitted',
};

/** Whether the week can be sent for approval: still open, with time on it. */
export function canSubmitWeek(week: Pick<TimeWeek, 'editable' | 'total' | 'status'>): boolean {
  return week.editable && week.total > 0 && week.status !== 'submitted' && week.status !== 'approved';
}

/** Only time and materials projects bill hours; the billable switch shows on those alone. */
export function billsHours(metadata: Record<string, unknown> | undefined | null): boolean {
  return metadata?.billing_type === 'time_and_materials';
}

// ---- Errors ----

/** The API's error code ("no_employee_record", "timesheet_locked", ...), if any. */
export function timeErrorCode(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { code?: unknown } } })?.response?.data;
  return typeof data?.code === 'string' ? data.code : undefined;
}

/** The dates a timer stop across midnight logged before it failed (logged_segments). */
export function loggedSegments(err: unknown): TimeSegment[] {
  const raw = (err as { response?: { data?: { logged_segments?: unknown } } })?.response?.data?.logged_segments;
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is TimeSegment => !!s && isYmd((s as TimeSegment).date) && typeof (s as TimeSegment).hours === 'number');
}

// ---- The running timer and its offline stop ----

/** A timer from the API or the browser's copy; null for anything else ({data: null}, junk). */
export function readTimer(raw: unknown): RunningTimer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const t = raw as Record<string, unknown>;
  const str = (k: string) => typeof t[k] === 'string' && (t[k] as string).length > 0;
  if (!str('project_id') || !str('task_id') || !str('started_at') || Number.isNaN(Date.parse(t.started_at as string))) return null;
  return {
    project_id: t.project_id as string,
    task_id: t.task_id as string,
    task_title: typeof t.task_title === 'string' ? t.task_title : '',
    started_at: t.started_at as string,
  };
}

/** Whether two RFC 3339 starts are the same instant (the API keeps nanoseconds; JS reads ms). */
export function sameStart(a: string, b: string): boolean {
  const x = Date.parse(a);
  const y = Date.parse(b);
  return !Number.isNaN(x) && x === y;
}

/**
 * The start of the part of a run still to log after a stop across midnight logged its first
 * date(s): the midnight after the last logged date, in the zone the stop was split in.
 */
export function remainingStart(startedAt: string, logged: TimeSegment[], tz: string): string {
  if (logged.length === 0) return startedAt;
  const dates = logged.map((s) => s.date).sort();
  const last = dates[dates.length - 1];
  const next = zonedMidnight(addDays(last, 1), tz);
  const start = Date.parse(startedAt);
  return Number.isNaN(start) || next.getTime() > start ? next.toISOString() : startedAt;
}

/**
 * The offline queue key of a week cell. A newer edit of the same cell replaces the waiting one,
 * and a PUT sets the hours, so a replay changes nothing twice.
 */
export function entryQueueKey(e: Pick<TimeEntryInput, 'project_id' | 'task_id' | 'date' | 'user_id'>): string {
  return `time-entry:${e.user_id || 'me'}:${e.project_id}:${e.task_id || '-'}:${e.date}`;
}

/**
 * The offline queue key of a timer stop: the task and the run's start. The stop route takes no
 * Idempotency-Key, so a run is queued once whatever is tapped, and the replay checks the server's
 * timer first (see useOfflineQueue).
 */
export function stopQueueKey(taskId: string, timerStartedAt: string): string {
  return `timer-stop:${taskId}:${timerStartedAt}`;
}
