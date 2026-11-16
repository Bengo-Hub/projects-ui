'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { backoffMs, staleScopesFor, type WorkEvent } from '@/lib/work/sse';

export type StreamState = 'connecting' | 'live' | 'reconnecting' | 'off';

/**
 * Live updates for one project (US-12.9). The stream carries ids only, so each event marks the
 * matching cached reads stale and TanStack refetches what is on screen. After a reconnect
 * everything for the project is refetched, since events sent while away are lost. Reconnects back
 * off from 1 s to 30 s; a 401 is left to the API client and a 403 or 404 stops the stream.
 */
export function useProjectStream(orgSlug: string, projectId: string, enabled = true): StreamState {
  const qc = useQueryClient();
  const [state, setState] = useState<StreamState>('off');
  const timers = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = enabled && !!orgSlug && !!projectId;

  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    let attempt = 0;
    let stopped = false;
    // Bursts (a bulk move) are folded into one refetch per key every 300 ms.
    const pending = new Map<string, readonly unknown[]>();
    const flush = () => {
      timers.current = null;
      for (const key of pending.values()) void qc.invalidateQueries({ queryKey: key });
      pending.clear();
    };
    const mark = (key: readonly unknown[]) => {
      pending.set(JSON.stringify(key), key);
      if (!timers.current) timers.current = setTimeout(flush, 300);
    };
    const refetchAll = () => {
      mark(['tasks', orgSlug, projectId]);
      mark(['gantt', orgSlug, projectId]);
      mark(['comments', orgSlug, projectId]);
      mark(['attachments', orgSlug, projectId]);
      mark(['my-work', orgSlug]);
    };

    const onEvent = (event: string, data: string) => {
      if (event === 'connected') {
        if (attempt > 0) refetchAll();
        attempt = 0;
        setState('live');
        return;
      }
      let e: WorkEvent;
      try {
        const parsed = JSON.parse(data) as WorkEvent;
        e = { ...parsed, type: parsed.type || event };
      } catch {
        return;
      }
      const s = staleScopesFor(e);
      if (s.board) mark(['tasks', orgSlug, projectId]);
      else if (s.task) mark(['tasks', orgSlug, projectId, 'detail', s.task]);
      if (s.comments) mark(['comments', orgSlug, projectId, s.comments]);
      if (s.attachments) mark(['attachments', orgSlug, projectId]);
      if (s.gantt) mark(['gantt', orgSlug, projectId]);
      if (s.myWork) mark(['my-work', orgSlug]);
    };

    const run = async () => {
      while (!stopped) {
        setState(attempt === 0 ? 'connecting' : 'reconnecting');
        try {
          await apiClient.stream(`/api/v1/${orgSlug}/projects/${projectId}/stream`, onEvent, ctrl.signal);
        } catch (err) {
          if (stopped) return;
          const status = (err as { status?: number }).status;
          if (status === 401 || status === 403 || status === 404) {
            setState('off');
            return;
          }
        }
        if (stopped) return;
        const wait = backoffMs(attempt);
        attempt += 1;
        setState('reconnecting');
        await new Promise((r) => setTimeout(r, wait));
      }
    };
    void run();

    return () => {
      stopped = true;
      ctrl.abort();
      if (timers.current) clearTimeout(timers.current);
      timers.current = null;
    };
  }, [qc, orgSlug, projectId, active]);

  // A switched-off stream reads as off straight away, whatever the last connection said.
  return active ? state : 'off';
}
