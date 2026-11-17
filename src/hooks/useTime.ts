'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { timeApi } from '@/lib/api/time';
import { membersApi } from '@/lib/api/members';
import { personLabel } from '@/lib/work/people';
import { apiErrorMessage, forbiddenKind, httpStatusOf } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import { useServicePermissions } from '@/hooks/usePermissions';
import { sendOrQueue, sendTimerStop, useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useAuthStore } from '@/store/auth';
import { pendingStops, pendingTimeEntries, type QueuedEdit } from '@/lib/work/offline-queue';
import {
  applyEntry,
  entryQueueKey,
  formatTotal,
  readTimer,
  sameStart,
  stopQueueKey,
  timeErrorCode,
  type RowNames,
  type RunningTimer,
  type TimeEntryInput,
  type TimeWeek,
} from '@/lib/work/time';

const KEY = 'time';

/** The message the API sends with no_employee_record, kept for a toast that names the fix. */
export const NO_EMPLOYEE_TEXT = 'Your account has no employee record in ERP. Ask HR to link it.';

/**
 * What the user may do with time, matching projects-api: every route needs the time_tracking
 * feature and ERP's attendance feature (the hours land on ERP timesheets); view_own reads my week,
 * add logs and runs the timer, view reads someone else's week and manage logs for them.
 */
export function useTimeAccess() {
  const { can, profile, isLoading } = useServicePermissions();
  const tracking = useFeature('time_tracking');
  const attendance = useFeature('attendance');
  const plan = tracking && attendance;
  return {
    me: profile?.user_id ?? '',
    isLoading,
    plan,
    canView: plan && can(PERMS.timeViewOwn),
    canLog: plan && can(PERMS.timeAdd),
    canViewOthers: plan && can(PERMS.timeView),
    canLogForOthers: plan && can(PERMS.timeManage),
  };
}

/** The browser's IANA zone: the API splits days (and timer runs at midnight) in it. */
export function useBrowserTimeZone(): string {
  return useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi';
    } catch {
      return 'Africa/Nairobi';
    }
  }, []);
}

/** A refusal (4xx) does not change on a retry; no answer or a 5xx is retried twice. */
function retryUnlessRefused(failureCount: number, err: unknown) {
  const s = httpStatusOf(err);
  if (s !== undefined && s >= 400 && s < 500) return false;
  return failureCount < 2;
}

/** A toast for a refused time call; no_employee_record names the fix once, never in a loop. */
function timeError(fallback: string) {
  return (err: unknown) => {
    if (forbiddenKind(err)) return;
    if (timeErrorCode(err) === 'no_employee_record') {
      toast.error(NO_EMPLOYEE_TEXT, { id: 'no-employee-record' });
      return;
    }
    toast.error(apiErrorMessage(err, fallback), { id: `time-${timeErrorCode(err) ?? 'error'}` });
  };
}

export function weekKey(orgSlug: string, weekStart: string, tz: string, userId?: string): QueryKey {
  return [KEY, orgSlug, 'week', weekStart, tz, userId || 'me'];
}

/**
 * The week holding weekStart (mine, or userId's with projects.time.view), with the entries still
 * waiting in the offline queue shown applied.
 */
export function useWeek(orgSlug: string, weekStart: string, tz: string, userId?: string, enabled = true) {
  const query = useQuery({
    queryKey: weekKey(orgSlug, weekStart, tz, userId),
    queryFn: () => timeApi.week(orgSlug, weekStart, tz, userId),
    enabled: enabled && !!orgSlug && !!weekStart,
    staleTime: 30_000,
    retry: retryUnlessRefused,
  });
  const queue = useOfflineQueue();
  const week = useMemo(() => {
    if (!query.data) return undefined;
    let w: TimeWeek = query.data;
    for (const e of pendingTimeEntries(queue, orgSlug, userId)) w = applyEntry(w, e.entry, e.names);
    return w;
  }, [query.data, queue, orgSlug, userId]);
  return { ...query, week };
}

// ---- The browser's copy of the running timer ----

// The server is the source of truth (GET /time/timer); this copy lets the header show the timer and
// stop it after a reload while offline. One per user and organisation.
const COPY_KEY = 'projects-running-timer';
const copyCache = new Map<string, { raw: string | null; value: RunningTimer | null }>();
const copyListeners = new Set<() => void>();

function readCopy(key: string): RunningTimer | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const hit = copyCache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value: RunningTimer | null = null;
  try {
    value = raw ? readTimer(JSON.parse(raw)) : null;
  } catch {
    value = null;
  }
  copyCache.set(key, { raw, value });
  return value;
}

function writeCopy(key: string, t: RunningTimer | null) {
  try {
    if (t) localStorage.setItem(key, JSON.stringify(t));
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked: the server copy still works online */
  }
  copyListeners.forEach((l) => l());
}

function subscribeCopy(l: () => void) {
  copyListeners.add(l);
  window.addEventListener('storage', l);
  return () => {
    copyListeners.delete(l);
    window.removeEventListener('storage', l);
  };
}

function useCopyKey(orgSlug: string) {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return userId && orgSlug ? `${COPY_KEY}:${userId}:${orgSlug}` : '';
}

/** Whether a waiting stop already covers this run (the server still runs it until the stop is sent). */
function stopWaiting(queue: QueuedEdit[], orgSlug: string, t: RunningTimer) {
  return pendingStops(queue, orgSlug).some((s) => s.taskId === t.task_id && sameStart(s.timerStartedAt, t.started_at));
}

/**
 * The user's running timer: the server's answer, or the browser's copy while the server cannot be
 * reached. A run whose stop waits in the offline queue reads as stopped.
 */
export function useRunningTimer(orgSlug: string) {
  const access = useTimeAccess();
  const key = useCopyKey(orgSlug);
  const query = useQuery({
    queryKey: [KEY, orgSlug, 'timer'],
    queryFn: () => timeApi.runningTimer(orgSlug),
    enabled: access.canView && !!orgSlug,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: retryUnlessRefused,
  });
  const copy = useSyncExternalStore(
    subscribeCopy,
    () => (key ? readCopy(key) : null),
    () => null,
  );
  useEffect(() => {
    if (key && query.isSuccess) writeCopy(key, query.data);
  }, [key, query.isSuccess, query.data]);
  const queue = useOfflineQueue();
  const raw = query.isSuccess ? query.data : copy;
  const timer = raw && !stopWaiting(queue, orgSlug, raw) ? raw : null;
  return { timer, isLoading: query.isLoading, fromCopy: !query.isSuccess && !!copy, enabled: access.canView };
}

function useSetTimer(orgSlug: string) {
  const qc = useQueryClient();
  const key = useCopyKey(orgSlug);
  return (t: RunningTimer | null) => {
    qc.setQueryData([KEY, orgSlug, 'timer'], t);
    if (key) writeCopy(key, t);
  };
}

/** Starts the timer on a task (needs a connection: the server stamps the start). */
export function useStartTimer(orgSlug: string) {
  const qc = useQueryClient();
  const setTimer = useSetTimer(orgSlug);
  const tz = useBrowserTimeZone();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; taskTitle: string }) => timeApi.startTimer(orgSlug, taskId, tz),
    onSuccess: (res, vars) => {
      setTimer(readTimer({ ...res.timer, task_title: res.timer.task_title || vars.taskTitle }));
      const logged = res.stopped.flatMap((s) => s.segments).reduce((sum, s) => sum + s.hours, 0);
      if (res.stopped.length > 0) toast.success(`Timer started. The one that was running logged ${formatTotal(logged)} h.`);
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'week'] });
    },
    onError: timeError('The timer could not be started'),
  });
}

/**
 * Stops the running timer with the browser's own start and stop times. Offline, or with no answer,
 * the stop waits in the offline queue (keyed by the task and the run's start) and the header shows
 * no timer; the run is logged when the browser reconnects.
 */
export function useStopTimer(orgSlug: string) {
  const qc = useQueryClient();
  const setTimer = useSetTimer(orgSlug);
  const tz = useBrowserTimeZone();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ timer, note }: { timer: RunningTimer; note?: string }) => {
      const stoppedAt = new Date();
      // Never before the start: a clock that moved back would make the API refuse the run.
      const startMs = Date.parse(timer.started_at);
      const stop = {
        project_id: timer.project_id,
        task_id: timer.task_id,
        started_at: timer.started_at,
        stopped_at: new Date(Math.max(stoppedAt.getTime(), startMs + 1000)).toISOString(),
        ...(note?.trim() ? { note: note.trim() } : {}),
      };
      const edit = {
        kind: 'timer-stop' as const,
        key: stopQueueKey(timer.task_id, timer.started_at),
        orgSlug,
        projectId: timer.project_id,
        taskId: timer.task_id,
        stop,
        timerStartedAt: timer.started_at,
        tz,
        taskTitle: timer.task_title,
      };
      return sendOrQueue(edit, () => sendTimerStop({ ...edit, createdAt: Date.now(), attempts: 0 }));
    },
    onMutate: ({ timer }) => {
      setTimer(null);
      return { timer };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.timer) setTimer(ctx.timer);
      timeError('The timer could not be stopped')(err);
    },
    onSuccess: (res) => {
      if (res.queued) {
        toast.info('You are offline. The timer stopped here and the time will be logged when you reconnect.', { id: 'offline-queued' });
        return;
      }
      const result = res.result;
      if ('alreadyLogged' in result) {
        toast.info('This timer was already stopped and logged.');
        return;
      }
      const hours = result.segments.reduce((sum, s) => sum + s.hours, 0);
      toast.success(`Logged ${formatTotal(hours)} h.`);
    },
    onSettled: (res) => {
      if (res && res.queued) return;
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
    },
  });
}

/** Discards the timer on a task without logging (asked first in the UI). */
export function useDiscardTimer(orgSlug: string) {
  const qc = useQueryClient();
  const setTimer = useSetTimer(orgSlug);
  return useMutation({
    mutationFn: (taskId: string) => timeApi.discardTimer(orgSlug, taskId),
    onSuccess: () => {
      setTimer(null);
      toast.success('Timer discarded. No time was logged.');
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'timer'] });
    },
    onError: timeError('The timer could not be discarded'),
  });
}

/**
 * Sets one day's hours (and note and billable flag) on a project and task. The week updates at
 * once; offline, or with no answer, the edit waits in the queue (a newer edit of the same cell
 * replaces it) and is sent on reconnect. A refusal rolls the cell back.
 */
export function usePutEntry(orgSlug: string, key: QueryKey) {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ entry, names }: { entry: TimeEntryInput; names?: RowNames }) =>
      sendOrQueue({ kind: 'time-entry', key: entryQueueKey(entry), orgSlug, projectId: entry.project_id, taskId: entry.task_id ?? '', entry, names }, () =>
        timeApi.putEntry(orgSlug, entry),
      ),
    onMutate: async ({ entry, names }) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<TimeWeek>(key);
      if (before) qc.setQueryData<TimeWeek>(key, applyEntry(before, entry, names));
      return { before };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before);
      timeError('The hours could not be saved')(err);
    },
    onSuccess: (res) => {
      if (res.queued) toast.info('You are offline. Your hours are saved here and will be sent when you reconnect.', { id: 'offline-queued' });
    },
    onSettled: (res) => {
      if (res && res.queued) return;
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}

/** People prefetched for the picker; more are found by searching (GET /time/people?q=). */
const PEOPLE_PAGE = 100;

export interface TimePickerPerson {
  userId: string;
  name: string;
}

/**
 * The people a manager (projects.time.view) can pick for the week view: the tenant's staff from
 * GET /time/people (never portal clients), me first. The first PEOPLE_PAGE come up front; search
 * finds anyone else by name or email on the server, so a large firm is never cut short.
 */
export function useTimePeople(orgSlug: string, enabled: boolean) {
  const { profile } = useServicePermissions();
  const query = useQuery({
    queryKey: [KEY, orgSlug, 'people'],
    queryFn: () => timeApi.people(orgSlug, '', PEOPLE_PAGE),
    enabled: enabled && !!orgSlug,
    staleTime: 5 * 60 * 1000,
  });
  const me = profile?.user_id ?? '';
  const myName = profile?.name || profile?.email || 'Me';
  const people = useMemo(() => {
    const byId = new Map<string, TimePickerPerson>();
    if (me) byId.set(me, { userId: me, name: `${myName} (you)` });
    for (const p of query.data?.data ?? []) {
      if (!byId.has(p.user_id)) {
        byId.set(p.user_id, { userId: p.user_id, name: personLabel({ userId: p.user_id, name: p.name, email: p.email }) });
      }
    }
    return [...byId.values()].sort((a, b) => Number(b.userId === me) - Number(a.userId === me) || a.name.localeCompare(b.name));
  }, [me, myName, query.data]);
  const search = async (q: string): Promise<TimePickerPerson[]> => {
    const res = await timeApi.people(orgSlug, q, 20);
    return res.data.map((p) => ({ userId: p.user_id, name: personLabel({ userId: p.user_id, name: p.name, email: p.email }) }));
  };
  return { people, search, isLoading: query.isLoading };
}

/** Sends ERP's submit transition for my week; approval stays in ERP. */
export function useSubmitWeek(orgSlug: string, tz: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekStart: string) => timeApi.submitWeek(orgSlug, weekStart, tz),
    onSuccess: () => {
      toast.success('Week submitted for approval');
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'week'] });
    },
    onError: timeError('The week could not be submitted'),
  });
}
