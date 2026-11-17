'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Square } from 'lucide-react';
import { useOnlineStatus } from '@bengo-hub/shared-ui-lib/offline';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useDiscardTimer, useRunningTimer, useStartTimer, useStopTimer, useTimeAccess } from '@/hooks/useTime';
import { elapsedMs, formatElapsed, type RunningTimer } from '@/lib/work/time';
import { cn } from '@/lib/utils';

/** The current time, ticking every second while active (for a running timer's elapsed time). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function Elapsed({ timer, className }: { timer: RunningTimer; className?: string }) {
  const now = useNow(true);
  return <span className={cn('tabular-nums', className)}>{formatElapsed(elapsedMs(timer.started_at, now))}</span>;
}

/** Stops a card's drag or keyboard pick-up when the press lands on this button. */
const keepFromDrag = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
};

interface TimerTask {
  id: string;
  title: string;
}

/**
 * Start or stop my timer on a task (US-13.1). Starting needs a connection (the server stamps the
 * start and stops any other timer); stopping works offline and is logged on reconnect. Hidden
 * without the plan features or projects.time.add.
 */
export function TimerButton({ orgSlug, task, compact = false }: { orgSlug: string; task: TimerTask; compact?: boolean }) {
  const access = useTimeAccess();
  const { timer } = useRunningTimer(orgSlug);
  const online = useOnlineStatus();
  const start = useStartTimer(orgSlug);
  const stop = useStopTimer(orgSlug);
  if (!access.canLog) return null;

  const here = timer?.task_id === task.id ? timer : null;
  const busy = start.isPending || stop.isPending;

  if (here) {
    const label = `Stop the timer on ${task.title}`;
    return compact ? (
      <button
        type="button"
        {...keepFromDrag}
        onClick={() => stop.mutate({ timer: here })}
        disabled={busy}
        aria-label={label}
        title={label}
        className="inline-flex h-10 items-center gap-1 rounded-md bg-destructive/10 px-2 text-xs font-medium text-destructive hover:bg-destructive/20 sm:h-8"
      >
        <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
        <Elapsed timer={here} />
      </button>
    ) : (
      <Button variant="destructive" onClick={() => stop.mutate({ timer: here })} disabled={busy} aria-label={label} className="h-11 sm:h-9">
        <Square className="h-4 w-4 fill-current" aria-hidden />
        Stop <Elapsed timer={here} />
      </Button>
    );
  }

  const other = timer ? ` It stops the timer on ${timer.task_title || 'another task'}.` : '';
  const label = online ? `Start a timer on ${task.title}.${other}` : 'Starting a timer needs a connection';
  return compact ? (
    <button
      type="button"
      {...keepFromDrag}
      onClick={() => start.mutate({ taskId: task.id, taskTitle: task.title })}
      disabled={busy || !online}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 sm:h-8 sm:w-8"
    >
      <Play className="h-4 w-4" aria-hidden />
    </button>
  ) : (
    <Button variant="outline" onClick={() => start.mutate({ taskId: task.id, taskTitle: task.title })} disabled={busy || !online} title={label} className="h-11 sm:h-9">
      <Play className="h-4 w-4" aria-hidden />
      {timer ? 'Switch timer here' : 'Start timer'}
    </Button>
  );
}

/** The drawer's time row: the timer and, while it runs here, a discard that logs nothing. */
export function TaskTimerSection({ orgSlug, task }: { orgSlug: string; task: TimerTask }) {
  const access = useTimeAccess();
  const { timer } = useRunningTimer(orgSlug);
  const discard = useDiscardTimer(orgSlug);
  const online = useOnlineStatus();
  const [confirm, setConfirm] = useState(false);
  if (!access.canLog) return null;
  const here = timer?.task_id === task.id;
  return (
    <section aria-labelledby="timer-heading" className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
      <h3 id="timer-heading" className="mr-auto text-sm font-semibold">
        Time
      </h3>
      <TimerButton orgSlug={orgSlug} task={task} />
      {here && (
        <Button variant="ghost" className="h-11 sm:h-9" disabled={!online || discard.isPending} onClick={() => setConfirm(true)}>
          Discard
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        variant="danger"
        title="Discard this timer?"
        description="The time it has run is not logged anywhere."
        confirmLabel="Discard"
        loading={discard.isPending}
        onConfirm={() => discard.mutate(task.id, { onSettled: () => setConfirm(false) })}
      />
    </section>
  );
}

/**
 * The running timer in the header, on every page: elapsed time, the task (a link to it) and stop.
 * It follows the server's timer, so a reload or another device shows it, and falls back to the
 * browser's copy while offline.
 */
export function TimerPill({ orgSlug }: { orgSlug: string }) {
  const access = useTimeAccess();
  const { timer } = useRunningTimer(orgSlug);
  const stop = useStopTimer(orgSlug);
  if (!timer || !access.canView) return null;
  const title = timer.task_title || 'Task';
  return (
    <div data-testid="timer-pill" className="flex h-10 min-w-0 items-center gap-1 rounded-full border border-border bg-muted pl-3 pr-1">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden />
      <Link
        href={`/${orgSlug}/projects/${timer.project_id}/tasks?task=${timer.task_id}`}
        className="flex min-w-0 items-center gap-2 text-sm hover:underline"
        aria-label={`Timer running on ${title}`}
      >
        <span className="hidden max-w-40 truncate md:inline">{title}</span>
        <Elapsed timer={timer} className="font-medium" />
      </Link>
      {access.canLog && (
        <button
          type="button"
          onClick={() => stop.mutate({ timer })}
          disabled={stop.isPending}
          aria-label={`Stop the timer on ${title}`}
          title="Stop and log the time"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10"
        >
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
        </button>
      )}
    </div>
  );
}
