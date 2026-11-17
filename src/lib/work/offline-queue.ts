// The offline queue for status, comment and checklist edits (US-12.10) and for week edits and
// timer stops (US-13.5). Pure: the store that persists it and the runner that sends it live in
// src/hooks/useOfflineQueue.ts. Task edits carry their Idempotency-Key, so a replay the API
// already applied changes nothing; the time kinds are keyed by what they change instead (see
// entryQueueKey and stopQueueKey in ./time).

import type { ChecklistOp } from './checklist';
import type { RowNames, TimeEntryInput, TimerStopInput } from './time';

interface Base {
  /** The Idempotency-Key (task edits) or the time key: one per change, kept across retries. */
  key: string;
  orgSlug: string;
  projectId: string;
  /** Empty for a week entry on a project without a task. */
  taskId: string;
  createdAt: number;
  attempts: number;
}

export type QueuedEdit =
  | (Base & { kind: 'status'; status: string })
  | (Base & { kind: 'comment'; content: string })
  | (Base & { kind: 'checklist'; op: ChecklistOp })
  | (Base & { kind: 'time-entry'; entry: TimeEntryInput; names?: RowNames })
  | (Base & {
      kind: 'timer-stop';
      stop: TimerStopInput;
      /** The server timer's own start; stop.started_at moves past dates a partial stop logged. */
      timerStartedAt: string;
      /** The zone the run is split at midnight in. */
      tz: string;
      taskTitle?: string;
    });

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An edit as a caller hands it over; the store stamps createdAt and attempts. */
export type QueuedEditInput = DistributiveOmit<QueuedEdit, 'createdAt' | 'attempts'>;

export const QUEUE_STORAGE_KEY = 'projects-offline-queue';
/** Kept in line with the API's 24 hour idempotency window: older edits are dropped, not replayed. */
export const QUEUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Week edits and timer stops have no idempotency window (a PUT sets the hours; a stop checks the
 * server's timer first), and logged time is worth keeping, so they wait a week.
 */
export const TIME_QUEUE_MAX_AGE_MS = 7 * QUEUE_MAX_AGE_MS;
const MAX_ENTRIES = 200;

export function isTimeEdit(e: QueuedEdit): e is Extract<QueuedEdit, { kind: 'time-entry' | 'timer-stop' }> {
  return e.kind === 'time-entry' || e.kind === 'timer-stop';
}

/**
 * Adds an edit. A newer status of the same task replaces the waiting one (only the last state
 * matters); comments and checklist operations always queue in order, each applied on its own.
 */
export function enqueue(queue: QueuedEdit[], edit: QueuedEdit): QueuedEdit[] {
  const rest = queue.filter((q) => q.key !== edit.key && !(edit.kind === 'status' && q.kind === 'status' && q.taskId === edit.taskId));
  return [...rest, edit].slice(-MAX_ENTRIES);
}

/** The checklist operations still waiting for a task, oldest first (the drawer shows them applied). */
export function pendingChecklistOps(queue: QueuedEdit[], taskId: string): ChecklistOp[] {
  const out: ChecklistOp[] = [];
  for (const q of queue) if (q.kind === 'checklist' && q.taskId === taskId) out.push(q.op);
  return out;
}

/** Whether a stored checklist operation is well formed. */
export function isChecklistOp(v: unknown): v is ChecklistOp {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.item_id !== 'string' || !o.item_id) return false;
  switch (o.op) {
    case 'add':
    case 'rename':
      return typeof o.text === 'string' && o.text.trim().length > 0;
    case 'toggle':
      return typeof o.done === 'boolean';
    case 'remove':
      return true;
    case 'reorder':
      return typeof o.position === 'number';
    default:
      return false;
  }
}

export function dequeue(queue: QueuedEdit[], key: string): QueuedEdit[] {
  return queue.filter((q) => q.key !== key);
}

export function markAttempt(queue: QueuedEdit[], key: string): QueuedEdit[] {
  return queue.map((q) => (q.key === key ? { ...q, attempts: q.attempts + 1 } : q));
}

/** Drops edits older than the idempotency window (a week for time). */
export function prune(queue: QueuedEdit[], now: number): QueuedEdit[] {
  return queue.filter((q) => now - q.createdAt < (isTimeEdit(q) ? TIME_QUEUE_MAX_AGE_MS : QUEUE_MAX_AGE_MS));
}

/** Replaces a waiting edit in place (a partial timer stop moves its start past logged dates). */
export function replaceEdit(queue: QueuedEdit[], next: QueuedEdit): QueuedEdit[] {
  return queue.map((q) => (q.key === next.key ? next : q));
}

/** The week entries still waiting in an organisation, oldest first (the week shows them applied). */
export function pendingTimeEntries(queue: QueuedEdit[], orgSlug: string, userId?: string): Extract<QueuedEdit, { kind: 'time-entry' }>[] {
  return queue.filter(
    (q): q is Extract<QueuedEdit, { kind: 'time-entry' }> => q.kind === 'time-entry' && q.orgSlug === orgSlug && (q.entry.user_id || '') === (userId || ''),
  );
}

/** The timer stops still waiting in an organisation. */
export function pendingStops(queue: QueuedEdit[], orgSlug: string): Extract<QueuedEdit, { kind: 'timer-stop' }>[] {
  return queue.filter((q): q is Extract<QueuedEdit, { kind: 'timer-stop' }> => q.kind === 'timer-stop' && q.orgSlug === orgSlug);
}

/** The waiting status of a task, for showing a queued move on the board. */
export function pendingStatus(queue: QueuedEdit[], taskId: string): string | undefined {
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (q.kind === 'status' && q.taskId === taskId) return q.status;
  }
  return undefined;
}

export function serialize(queue: QueuedEdit[]): string {
  return JSON.stringify(queue);
}

/** Reads a stored queue, skipping anything malformed. */
export function deserialize(raw: string | null | undefined): QueuedEdit[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: QueuedEdit[] = [];
  for (const v of parsed) {
    if (!v || typeof v !== 'object') continue;
    const e = v as Record<string, unknown>;
    const str = (k: string) => typeof e[k] === 'string' && (e[k] as string).length > 0;
    // A week entry may have no task; every other kind names one.
    const taskOk = e.kind === 'time-entry' ? typeof e.taskId === 'string' : str('taskId');
    if (!str('key') || !str('orgSlug') || !str('projectId') || !taskOk || typeof e.createdAt !== 'number') continue;
    const attempts = typeof e.attempts === 'number' ? e.attempts : 0;
    const base = { key: e.key as string, orgSlug: e.orgSlug as string, projectId: e.projectId as string, taskId: e.taskId as string, createdAt: e.createdAt, attempts };
    if (e.kind === 'status' && str('status')) out.push({ ...base, kind: 'status', status: e.status as string });
    else if (e.kind === 'comment' && str('content')) out.push({ ...base, kind: 'comment', content: e.content as string });
    else if (e.kind === 'checklist' && isChecklistOp(e.op)) out.push({ ...base, kind: 'checklist', op: e.op });
    else if (e.kind === 'time-entry' && isTimeEntry(e.entry)) {
      const names = e.names && typeof e.names === 'object' ? { names: e.names as RowNames } : {};
      out.push({ ...base, kind: 'time-entry', entry: e.entry, ...names });
    } else if (e.kind === 'timer-stop' && isTimerStop(e.stop) && str('timerStartedAt') && str('tz')) {
      const title = typeof e.taskTitle === 'string' ? { taskTitle: e.taskTitle } : {};
      out.push({ ...base, kind: 'timer-stop', stop: e.stop, timerStartedAt: e.timerStartedAt as string, tz: e.tz as string, ...title });
    }
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isTimeEntry(v: unknown): v is TimeEntryInput {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.project_id === 'string' && !!o.project_id && typeof o.date === 'string' && DATE.test(o.date) && typeof o.hours === 'number' && o.hours >= 0 && o.hours <= 24;
}

function isTimerStop(v: unknown): v is TimerStopInput {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const instant = (k: string) => typeof o[k] === 'string' && !Number.isNaN(Date.parse(o[k] as string));
  return typeof o.project_id === 'string' && !!o.project_id && instant('started_at') && instant('stopped_at');
}

/**
 * Whether a failed send should stay queued: no answer at all (offline, DNS, timeout) or a server
 * side failure. A 4xx is final (the task is gone, the status was removed, a permission changed).
 */
export function isRetryable(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: string } | undefined;
  const status = e?.response?.status;
  if (status === undefined) return true;
  return status === 408 || status === 429 || status >= 500;
}
