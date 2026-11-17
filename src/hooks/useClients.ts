'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { clientsApi } from '@/lib/api/clients';
import { apiErrorMessage, errorBody, forbiddenKind, onMutationError } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import { inviteOutcome } from '@/lib/portal/logic';
import { useServicePermissions } from '@/hooks/usePermissions';
import { newIdempotencyKey } from '@/hooks/useOfflineQueue';
import type { TaskDetail } from '@/types';

const KEY = 'clients';

/**
 * What the team may do with the client portal: everything needs the client_portal plan feature;
 * invites and sharing need projects.portal.manage, the client thread the comment codes.
 */
export function useClientPortalAccess() {
  const { can, isLoading } = useServicePermissions();
  const feature = useFeature('client_portal');
  return {
    isLoading,
    feature,
    canManage: feature && can(PERMS.portalManage),
    canViewThread: feature && can(PERMS.commentsView),
    canPostThread: feature && can(PERMS.commentsAdd),
  };
}

export function useProjectClients(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId],
    queryFn: () => clientsApi.list(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
  });
}

export function useInviteClient(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contact: { id: string; name: string }) => clientsApi.invite(orgSlug, projectId, contact.id),
    onSuccess: (res, contact) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      toast.success(inviteOutcome(res.client?.name || contact.name, res.resent));
    },
    onError: (err) => {
      if (forbiddenKind(err)) return;
      const code = errorBody(err)?.code;
      if (code === 'already_client') toast.error('This contact is already a client on the project.');
      else if (code === 'contact_not_found') toast.error('That contact is no longer in the CRM.');
      else if (code === 'validation_error') toast.error(apiErrorMessage(err, 'The contact needs a valid email in the CRM before they can be invited.'));
      else if (code === 'crm_unavailable') toast.error('The CRM could not be reached. Try again in a minute.');
      else toast.error(apiErrorMessage(err, 'The invite was not sent'));
    },
  });
}

export function useRevokeClient(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => clientsApi.revoke(orgSlug, projectId, memberId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      toast.success('Client access removed');
    },
    onError: onMutationError('Client access was not removed'),
  });
}

/** Shares a task with the project's clients, or stops sharing it. */
export function useShareTask(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, visible }: { taskId: string; visible: boolean }) => clientsApi.shareTask(orgSlug, projectId, taskId, visible),
    onSuccess: (res, { taskId }) => {
      qc.setQueryData<TaskDetail>(['tasks', orgSlug, projectId, 'detail', taskId], (t) =>
        t ? { ...t, metadata: { ...(t.metadata ?? {}), client_visible: res.client_visible } } : t,
      );
      void qc.invalidateQueries({ queryKey: ['tasks', orgSlug, projectId] });
      toast.success(res.client_visible ? 'The task now shows in the client portal' : 'The task is hidden from clients');
    },
    onError: onMutationError('Sharing was not changed'),
  });
}

export function useShareFile(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentId, visible }: { attachmentId: string; visible: boolean }) =>
      clientsApi.shareFile(orgSlug, projectId, attachmentId, visible),
    onSuccess: (_, { visible }) => {
      void qc.invalidateQueries({ queryKey: ['attachments', orgSlug, projectId] });
      toast.success(visible ? 'The file now shows in the client portal' : 'The file is hidden from clients');
    },
    onError: onMutationError('Sharing was not changed'),
  });
}

export function useClientThread(orgSlug: string, projectId: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, 'thread'],
    queryFn: ({ pageParam }) => clientsApi.thread(orgSlug, projectId, { limit: 50, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 30_000,
  });
  return { ...query, items: (query.data?.pages ?? []).flatMap((p) => p.data ?? []), total: query.data?.pages[0]?.total ?? 0 };
}

export function usePostClientThread(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => clientsApi.post(orgSlug, projectId, content, newIdempotencyKey()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, 'thread'] }),
    onError: onMutationError('Your message was not sent'),
  });
}
