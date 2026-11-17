import { apiClient } from './client';
import { readTimer, timerStopKey, type RunningTimer, type TimeEntryInput, type TimeSegment, type TimerStopInput, type TimeWeek } from '@/lib/work/time';

// Time tracking (sprint 13), projects-api docs/api.md "Time". The hours live in the user's ERP
// timesheet. Every route needs the time_tracking and attendance features; ?tz= (IANA) decides
// where a day starts, so the browser always sends its own zone.

/** What a timer stop logged: one segment per local date the run covered. */
export interface TimerStopped {
  segments: TimeSegment[];
  entries: unknown[];
}

/** A person on the week page's picker (GET /time/people). */
export interface TimePerson {
  user_id: string;
  name: string;
  email?: string;
}

export interface TimerStarted {
  timer: RunningTimer;
  /** A timer that was running on another task, stopped and logged first. */
  stopped: TimerStopped[];
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}`;
}

const withTz = (path: string, tz: string) => `${path}?tz=${encodeURIComponent(tz)}`;

export const timeApi = {
  /** The week (Monday to Sunday) holding weekStart; userId reads someone else's (projects.time.view). */
  week: (orgSlug: string, weekStart: string, tz: string, userId?: string) =>
    apiClient.get<TimeWeek>(`${base(orgSlug)}/time/week`, { week_start: weekStart, tz, ...(userId ? { user_id: userId } : {}) }),
  /** Sets one day's hours on a project and task (0 to 24). */
  putEntry: (orgSlug: string, entry: TimeEntryInput) => apiClient.put<unknown>(`${base(orgSlug)}/time/entries`, entry),
  /** ERP's submit transition for the signed-in user's week. The body is required, even empty. */
  submitWeek: (orgSlug: string, weekStart: string, tz: string) =>
    apiClient.post<{ data: unknown[] }>(withTz(`${base(orgSlug)}/time/week/submit`, tz), { week_start: weekStart }),
  /** The user's running timer anywhere, null when none runs. */
  runningTimer: (orgSlug: string) =>
    apiClient.get<{ data: unknown }>(`${base(orgSlug)}/time/timer`).then((r) => readTimer(r?.data)),
  /** The user's running timer on one task, null when none runs there. */
  taskTimer: (orgSlug: string, taskId: string) =>
    apiClient.get<{ data: unknown }>(`${base(orgSlug)}/tasks/${taskId}/timer`).then((r) => readTimer(r?.data)),
  /** Starts the timer on a task; a timer on another task is stopped and logged first. */
  startTimer: (orgSlug: string, taskId: string, tz: string) =>
    apiClient.post<TimerStarted>(withTz(`${base(orgSlug)}/tasks/${taskId}/timer`, tz), {}),
  /**
   * Logs a finished run (the browser's own start and stop) and clears the timer on its task. The
   * Idempotency-Key is fixed per run (task and start), so a replayed stop, or the same run stopped
   * from two devices, logs once: the API answers a repeat with Idempotent-Replayed and logs nothing.
   */
  stopTimer: (orgSlug: string, stop: TimerStopInput, tz: string) =>
    apiClient
      .postWithHeaders<TimerStopped>(withTz(`${base(orgSlug)}/time/timer/stop`, tz), stop, {
        'Idempotency-Key': timerStopKey(stop),
      })
      .then((r) => r.data),
  /** The tenant's staff a manager (projects.time.view) can pick; ?q= matches name or email. */
  people: (orgSlug: string, q: string, limit: number) =>
    apiClient.get<{ data: TimePerson[]; total: number }>(
      `${base(orgSlug)}/time/people?limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),
  /** Discards the timer on a task without logging anything. */
  discardTimer: (orgSlug: string, taskId: string) => apiClient.delete<void>(`${base(orgSlug)}/tasks/${taskId}/timer`),
};
