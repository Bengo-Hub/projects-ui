'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tasksApi } from '@/lib/api/tasks';
import { commentsApi } from '@/lib/api/comments';
import { apiErrorMessage } from '@/lib/api/errors';
import {
  QUEUE_STORAGE_KEY,
  dequeue,
  deserialize,
  enqueue,
  isRetryable,
  markAttempt,
  prune,
  serialize,
  type QueuedEdit,
  type QueuedEditInput,
} from '@/lib/work/offline-queue';

// One queue per signed-in user, kept in localStorage so edits made offline survive a reload. The
// runner (OfflineQueueRunner in the console shell) drains it when the browser is back online.

let owner = '';
let queue: QueuedEdit[] = [];
let draining = false;
let client: QueryClient | null = null;
const listeners = new Set<() => void>();

function storageKey() {
  return `${QUEUE_STORAGE_KEY}:${owner}`;
}

function persist() {
  try {
    if (owner) localStorage.setItem(storageKey(), serialize(queue));
  } catch {
    /* storage blocked: the queue still lives for this tab */
  }
}

function set(next: QueuedEdit[]) {
  queue = next;
  persist();
  listeners.forEach((l) => l());
}

function setOwner(userId: string) {
  if (userId === owner) return;
  owner = userId;
  let raw: string | null = null;
  try {
    raw = userId ? localStorage.getItem(storageKey()) : null;
  } catch {
    raw = null;
  }
  queue = prune(deserialize(raw), Date.now());
  listeners.forEach((l) => l());
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** A uuid for an Idempotency-Key, one per user action. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function invalidateFor(e: QueuedEdit) {
  if (!client) return;
  void client.invalidateQueries({ queryKey: ['tasks', e.orgSlug, e.projectId, 'detail', e.taskId] });
  if (e.kind === 'status') {
    void client.invalidateQueries({ queryKey: ['tasks', e.orgSlug, e.projectId] });
    void client.invalidateQueries({ queryKey: ['my-work', e.orgSlug] });
  }
  if (e.kind === 'comment') void client.invalidateQueries({ queryKey: ['comments', e.orgSlug, e.projectId, e.taskId] });
}

function send(e: QueuedEdit): Promise<unknown> {
  switch (e.kind) {
    case 'status':
      return tasksApi.changeStatus(e.orgSlug, e.projectId, e.taskId, e.status, e.key);
    case 'comment':
      return commentsApi.createOnTask(e.orgSlug, e.projectId, e.taskId, { content: e.content }, e.key);
    case 'checklist':
      return tasksApi.checklist(e.orgSlug, e.projectId, e.taskId, e.op, e.key);
  }
}

const LABEL: Record<QueuedEdit['kind'], string> = {
  status: 'A status change',
  comment: 'A comment',
  checklist: 'A checklist change',
};

/** Sends waiting edits in order; stops at the first one that still cannot get through. */
export async function drainQueue() {
  if (draining || isOffline() || queue.length === 0) return;
  draining = true;
  try {
    set(prune(queue, Date.now()));
    for (const e of [...queue]) {
      try {
        await send(e);
        set(dequeue(queue, e.key));
        invalidateFor(e);
      } catch (err) {
        if (isRetryable(err)) {
          set(markAttempt(queue, e.key));
          break;
        }
        set(dequeue(queue, e.key));
        invalidateFor(e);
        toast.error(`${LABEL[e.kind]} made offline could not be saved: ${apiErrorMessage(err, 'it was refused')}`);
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * Sends an edit now, or queues it when the browser is offline or the request got no answer. Used as
 * the mutationFn of the offline-tolerant mutations (networkMode 'always').
 */
export async function sendOrQueue<T>(edit: QueuedEditInput, sendNow: () => Promise<T>): Promise<{ queued: true } | { queued: false; result: T }> {
  const stamp = () => set(enqueue(queue, { ...edit, createdAt: Date.now(), attempts: 0 } as QueuedEdit));
  if (isOffline()) {
    stamp();
    return { queued: true };
  }
  try {
    return { queued: false, result: await sendNow() };
  } catch (err) {
    if (isRetryable(err)) {
      stamp();
      return { queued: true };
    }
    throw err;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => queue;
const serverSnapshot = (): QueuedEdit[] => [];

/** The waiting edits (for the banner and for showing queued moves). */
export function useOfflineQueue() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Loads the signed-in user's queue and drains it on start, on reconnect and every 30 s. */
export function useOfflineQueueRunner(userId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    client = qc;
    setOwner(userId);
    void drainQueue();
    const onOnline = () => void drainQueue();
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(() => void drainQueue(), 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [qc, userId]);
}
