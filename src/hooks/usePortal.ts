'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { portalApi } from '@/lib/api/portal';
import { apiErrorMessage, errorBody, httpStatusOf } from '@/lib/api/errors';
import { invitesNeedVerification, portalRefusal, type Decision } from '@/lib/portal/logic';
import { newIdempotencyKey } from '@/hooks/useOfflineQueue';
import { usePortalAuthStore } from '@/store/portal-auth';
import type { PaginatedResponse } from '@/types';

// Every portal query key starts with 'portal' and the signed-in client's id, so a sign-out (or a
// different client in the same browser) never sees another session's cache.
const KEY = 'portal';

function useScope(orgSlug: string) {
  const userId = usePortalAuthStore((s) => s.user?.id ?? '');
  const signedIn = usePortalAuthStore((s) => s.status === 'authenticated');
  return { userId, enabled: signedIn && !!orgSlug };
}

const noRetryOnRefusal = (n: number, err: unknown) => {
  const s = httpStatusOf(err);
  return s !== 401 && s !== 403 && s !== 404 && n < 2;
};

/** The landing list; also attaches pending invites (the API does that on this call). */
export function usePortalProjects(orgSlug: string) {
  const { userId, enabled } = useScope(orgSlug);
  const query = useQuery({
    queryKey: [KEY, userId, orgSlug, 'projects'],
    queryFn: () => portalApi.projects(orgSlug, { limit: 50 }),
    enabled,
    retry: noRetryOnRefusal,
    staleTime: 60_000,
  });
  return {
    ...query,
    projects: query.data?.page.data ?? [],
    needsVerification: invitesNeedVerification(query.data?.headers),
    refusal: portalRefusal(httpStatusOf(query.error), errorBody(query.error)?.code),
  };
}

export function usePortalSummary(orgSlug: string, projectId: string) {
  const { userId, enabled } = useScope(orgSlug);
  return useQuery({
    queryKey: [KEY, userId, orgSlug, projectId, 'summary'],
    queryFn: () => portalApi.summary(orgSlug, projectId),
    enabled: enabled && !!projectId,
    retry: noRetryOnRefusal,
  });
}

export function usePortalMilestones(orgSlug: string, projectId: string) {
  const { userId, enabled } = useScope(orgSlug);
  return useQuery({
    queryKey: [KEY, userId, orgSlug, projectId, 'milestones'],
    queryFn: () => portalApi.milestones(orgSlug, projectId),
    enabled: enabled && !!projectId,
    retry: noRetryOnRefusal,
  });
}

function usePaged<T>(orgSlug: string, projectId: string, part: string, fetch: (page: number) => Promise<PaginatedResponse<T>>, staleTime?: number) {
  const { userId, enabled } = useScope(orgSlug);
  const query = useInfiniteQuery({
    queryKey: [KEY, userId, orgSlug, projectId, part],
    queryFn: ({ pageParam }) => fetch(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!projectId,
    retry: noRetryOnRefusal,
    staleTime,
  });
  return { ...query, items: (query.data?.pages ?? []).flatMap((p) => p.data ?? []), total: query.data?.pages[0]?.total ?? 0 };
}

export function usePortalTasks(orgSlug: string, projectId: string) {
  return usePaged(orgSlug, projectId, 'tasks', (page) => portalApi.tasks(orgSlug, projectId, { limit: 20, page }));
}

/** Shared files; their links are signed for 15 minutes, so the list is fetched again after 10. */
export function usePortalFiles(orgSlug: string, projectId: string) {
  return usePaged(orgSlug, projectId, 'files', (page) => portalApi.files(orgSlug, projectId, { limit: 20, page }), 10 * 60_000);
}

/**
 * The project's sent and paid invoices, a page at a time. available and note come from the first
 * page: available false means billing is not connected to the portal, not an error.
 */
export function usePortalInvoices(orgSlug: string, projectId: string) {
  const { userId, enabled } = useScope(orgSlug);
  const query = useInfiniteQuery({
    queryKey: [KEY, userId, orgSlug, projectId, 'invoices'],
    queryFn: ({ pageParam }) => portalApi.invoices(orgSlug, projectId, { limit: 20, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? (last.page ?? 1) + 1 : undefined),
    enabled: enabled && !!projectId,
    retry: noRetryOnRefusal,
  });
  const first = query.data?.pages[0];
  return {
    ...query,
    items: (query.data?.pages ?? []).flatMap((p) => p.data ?? []),
    available: first?.available ?? false,
    note: first?.note,
  };
}

export function usePortalThread(orgSlug: string, projectId: string) {
  return usePaged(orgSlug, projectId, 'thread', (page) => portalApi.thread(orgSlug, projectId, { limit: 50, page }), 30_000);
}

export function usePortalPost(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  const { userId } = useScope(orgSlug);
  return useMutation({
    mutationFn: (content: string) => portalApi.post(orgSlug, projectId, content, newIdempotencyKey()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [KEY, userId, orgSlug, projectId, 'thread'] }),
    onError: (err) => toast.error(apiErrorMessage(err, 'Your message was not sent. Try again.')),
  });
}

/**
 * A milestone decision. A 409 milestone_not_ready (the team took it back, or another client
 * decided first) refreshes the list so the form goes away; the caller shows the message.
 */
export function usePortalDecision(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  const { userId } = useScope(orgSlug);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: [KEY, userId, orgSlug, projectId, 'milestones'] });
    void qc.invalidateQueries({ queryKey: [KEY, userId, orgSlug, projectId, 'summary'] });
    // The landing cards carry the awaiting review count.
    void qc.invalidateQueries({ queryKey: [KEY, userId, orgSlug, 'projects'] });
  };
  return useMutation({
    mutationFn: ({ milestoneId, decision, comment }: { milestoneId: string; decision: Decision; comment: string }) =>
      portalApi.decide(orgSlug, projectId, milestoneId, { decision, comment: comment.trim() }),
    onSuccess: (res) => {
      refresh();
      toast.success(res.decision === 'approve' ? 'Milestone approved. The team has been told.' : 'Your change request was sent to the team.');
    },
    onError: (err) => {
      if (portalRefusal(httpStatusOf(err), errorBody(err)?.code) === 'not_ready') {
        refresh();
        return;
      }
      toast.error(apiErrorMessage(err, 'Your decision was not saved. Try again.'));
    },
  });
}
