// The offline queue for status, comment and checklist edits (US-12.10). Pure: the store that
// persists it and the runner that sends it live in src/hooks/useOfflineQueue.ts. Every edit
// carries its Idempotency-Key, so a replay the API already applied changes nothing.

import type { ChecklistOp } from './checklist';

interface Base {
  /** The Idempotency-Key: one per user action, kept across retries. */
  key: string;
  orgSlug: string;
  projectId: string;
  taskId: string;
  createdAt: number;
  attempts: number;
}

export type QueuedEdit =
  | (Base & { kind: 'status'; status: string })
  | (Base & { kind: 'comment'; content: string })
  | (Base & { kind: 'checklist'; op: ChecklistOp });

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An edit as a caller hands it over; the store stamps createdAt and attempts. */
export type QueuedEditInput = DistributiveOmit<QueuedEdit, 'createdAt' | 'attempts'>;

export const QUEUE_STORAGE_KEY = 'projects-offline-queue';
/** Kept in line with the API's 24 hour idempotency window: older edits are dropped, not replayed. */
export const QUEUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

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

/** Drops edits older than the idempotency window. */
export function prune(queue: QueuedEdit[], now: number): QueuedEdit[] {
  return queue.filter((q) => now - q.createdAt < QUEUE_MAX_AGE_MS);
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
    if (!str('key') || !str('orgSlug') || !str('projectId') || !str('taskId') || typeof e.createdAt !== 'number') continue;
    const attempts = typeof e.attempts === 'number' ? e.attempts : 0;
    const base = { key: e.key as string, orgSlug: e.orgSlug as string, projectId: e.projectId as string, taskId: e.taskId as string, createdAt: e.createdAt, attempts };
    if (e.kind === 'status' && str('status')) out.push({ ...base, kind: 'status', status: e.status as string });
    else if (e.kind === 'comment' && str('content')) out.push({ ...base, kind: 'comment', content: e.content as string });
    else if (e.kind === 'checklist' && isChecklistOp(e.op)) out.push({ ...base, kind: 'checklist', op: e.op });
  }
  return out;
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
