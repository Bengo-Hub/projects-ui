'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearAccessToken, errorText, httpStatus, qaInviteeApi, storeAccessToken } from '@/lib/api/qa-invitee';
import {
  describeDevice,
  draftStorageKey,
  mergeVerdicts,
  normalizeVerdict,
  parseDrafts,
  pruneDrafts,
  verdictProblem,
  type QADrafts,
} from '@/lib/qa/logic';
import type { QAAccessGrant, QAInviteeSession, QAResult, QAVerdictInput } from '@/types/qa';

const KEY = 'qa-invitee';

export function useQAAccessInfo(code: string) {
  return useQuery({
    queryKey: [KEY, code, 'info'],
    queryFn: () => qaInviteeApi.accessInfo(code),
    enabled: !!code,
    retry: (n, err) => httpStatus(err) !== 404 && n < 2,
    staleTime: Infinity,
  });
}

/** The invitee's session; a 401 means "prove your email first". */
export function useQAInviteeSession(code: string) {
  return useQuery({
    queryKey: [KEY, code, 'session'],
    queryFn: () => qaInviteeApi.session(code),
    enabled: !!code,
    retry: (n, err) => {
      const s = httpStatus(err);
      return s !== 401 && s !== 403 && n < 2;
    },
    refetchOnWindowFocus: true,
  });
}

/** Keeps the grant for this tab and loads the session behind it. */
export function useQAGrant(code: string) {
  const qc = useQueryClient();
  return useCallback(
    (grant: QAAccessGrant) => {
      storeAccessToken(code, grant);
      void qc.invalidateQueries({ queryKey: [KEY, code, 'session'] });
    },
    [code, qc],
  );
}

export function useQAInviteeLogout(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => qaInviteeApi.logout(code).catch(() => undefined),
    onSettled: () => {
      clearAccessToken(code);
      qc.removeQueries({ queryKey: [KEY, code, 'session'] });
      void qc.invalidateQueries({ queryKey: [KEY, code, 'session'] });
    },
  });
}

export type SaveState = 'saved' | 'saving' | 'pending' | 'offline' | 'error' | 'incomplete';

const AUTOSAVE_MS = 800;

/**
 * The tester checklist's verdicts with autosave. Every change is kept on this device first
 * (localStorage), sent after a short pause, and dropped from the device once the API holds it.
 * Offline or on a network error the draft stays and is sent again when the browser is back online.
 */
export function useQAChecklist(code: string, session: QAInviteeSession | undefined) {
  const qc = useQueryClient();
  const sessionId = session?.session_id ?? '';
  const storageKey = sessionId ? draftStorageKey(sessionId, code) : '';
  const [drafts, setDrafts] = useState<QADrafts>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const draftsRef = useRef<QADrafts>({});
  const editable = session?.status === 'open' && session?.role === 'tester';

  const persist = useCallback(
    (next: QADrafts) => {
      draftsRef.current = next;
      setDrafts(next);
      if (!storageKey) return;
      try {
        if (Object.keys(next).length) localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {
        // Storage blocked: drafts live in memory for this visit only.
      }
    },
    [storageKey],
  );

  // Load drafts kept on this device, minus those the API already holds.
  useEffect(() => {
    if (!storageKey) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(storageKey);
    } catch {
      raw = null;
    }
    const kept = pruneDrafts(session?.my_results, parseDrafts(raw));
    persist(kept);
    setStates(Object.fromEntries(Object.keys(kept).map((k) => [k, 'pending' as SaveState])));
    // my_results changes after every save; only the first load prunes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const send = useCallback(
    async (criterionId: string) => {
      const v = draftsRef.current[criterionId];
      if (!v) return;
      if (verdictProblem(v)) {
        setStates((s) => ({ ...s, [criterionId]: 'incomplete' }));
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStates((s) => ({ ...s, [criterionId]: 'offline' }));
        return;
      }
      setStates((s) => ({ ...s, [criterionId]: 'saving' }));
      try {
        const out = await qaInviteeApi.recordResult(code, criterionId, {
          ...normalizeVerdict(v),
          device: describeDevice(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        });
        // Drop the draft only if nothing newer was typed while it was in flight.
        if (draftsRef.current[criterionId] === v) {
          const { [criterionId]: _sent, ...rest } = draftsRef.current;
          persist(rest);
        }
        qc.setQueryData<QAInviteeSession>([KEY, code, 'session'], (old) =>
          old
            ? { ...old, my_results: [...(old.my_results ?? []).filter((r: QAResult) => r.criterion_id !== criterionId), out.result] }
            : old,
        );
        setStates((s) => ({ ...s, [criterionId]: draftsRef.current[criterionId] ? 'pending' : 'saved' }));
        setErrors((e) => ({ ...e, [criterionId]: '' }));
      } catch (err) {
        const status = httpStatus(err);
        if (status === 401) {
          void qc.invalidateQueries({ queryKey: [KEY, code, 'session'] });
          setStates((s) => ({ ...s, [criterionId]: 'pending' }));
          return;
        }
        if (!status) {
          setStates((s) => ({ ...s, [criterionId]: 'offline' }));
          return;
        }
        setStates((s) => ({ ...s, [criterionId]: 'error' }));
        setErrors((e) => ({ ...e, [criterionId]: errorText(err, 'The verdict was not saved.') }));
      }
    },
    [code, persist, qc],
  );

  const change = useCallback(
    (criterionId: string, v: QAVerdictInput) => {
      if (!editable) return;
      persist({ ...draftsRef.current, [criterionId]: v });
      setStates((s) => ({ ...s, [criterionId]: verdictProblem(v) ? 'incomplete' : 'pending' }));
      clearTimeout(timers.current[criterionId]);
      timers.current[criterionId] = setTimeout(() => void send(criterionId), AUTOSAVE_MS);
    },
    [editable, persist, send],
  );

  const flush = useCallback(() => {
    for (const id of Object.keys(draftsRef.current)) void send(id);
  }, [send]);

  // Back online: send everything still kept on the device.
  useEffect(() => {
    if (!editable) return;
    window.addEventListener('online', flush);
    const t = setTimeout(flush, 0);
    return () => {
      window.removeEventListener('online', flush);
      clearTimeout(t);
    };
  }, [editable, flush]);

  useEffect(() => {
    const all = timers.current;
    return () => Object.values(all).forEach(clearTimeout);
  }, []);

  return {
    editable,
    verdicts: mergeVerdicts(session?.my_results, drafts),
    states,
    errors,
    pendingCount: Object.keys(drafts).length,
    change,
    retry: send,
  };
}
