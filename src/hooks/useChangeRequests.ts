'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { changesApi, type ChangeListParams, type ChangeRequest, type ChangeRequestInput } from '@/lib/api/planning';
import { errorBody, forbiddenKind } from '@/lib/api/errors';
import { changeErrorText } from '@/lib/planning/changes';

const KEY = 'change-requests';

/** A project's change requests, newest first. */
export function useProjectChanges(orgSlug: string, projectId: string, params: ChangeListParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'project', projectId, params],
    queryFn: () => changesApi.list(orgSlug, projectId, params),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 15_000,
  });
}

/** The tenant's requests across the projects the caller may see; status pending is the approvals queue. */
export function useChangeQueue(orgSlug: string, params: ChangeListParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'queue', params],
    queryFn: () => changesApi.queue(orgSlug, params),
    enabled: enabled && !!orgSlug,
    staleTime: 15_000,
  });
}

export function useChangeRequest(orgSlug: string, projectId: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'one', projectId, id],
    queryFn: () => changesApi.get(orgSlug, projectId, id),
    enabled: !!orgSlug && !!projectId && !!id,
  });
}

/** A refused write: the API's code turned into words. A 403 for the plan or a permission already toasted. */
export function onChangeError(fallback: string) {
  return (err: unknown) => {
    const body = errorBody(err);
    const kind = forbiddenKind(err);
    if (kind && body?.code !== 'own_change_request' && body?.code !== 'not_requester') return;
    toast.error(changeErrorText(body?.code, body?.error, fallback), { id: `change-${body?.code ?? 'error'}` });
  };
}

function useRefresh(orgSlug: string) {
  const qc = useQueryClient();
  return (cr?: ChangeRequest, projectId?: string) => {
    void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
    const pid = cr?.project_id ?? projectId;
    if (pid) {
      // An approval moves task dates.
      void qc.invalidateQueries({ queryKey: ['tasks', orgSlug, pid] });
      void qc.invalidateQueries({ queryKey: ['gantt', orgSlug, pid] });
      void qc.invalidateQueries({ queryKey: ['financials', orgSlug] });
    }
  };
}

export function useCreateChange(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug);
  return useMutation({
    mutationFn: (body: ChangeRequestInput) => changesApi.create(orgSlug, projectId, body),
    onSuccess: (cr) => {
      refresh(cr, projectId);
      toast.success('Change request raised. It waits for approval.');
    },
    onError: onChangeError('The change request was not raised'),
  });
}

type Act = { projectId: string; id: string };

export function useWithdrawChange(orgSlug: string) {
  const refresh = useRefresh(orgSlug);
  return useMutation({
    mutationFn: ({ projectId, id }: Act) => changesApi.withdraw(orgSlug, projectId, id),
    onSuccess: (cr) => {
      refresh(cr);
      toast.success('Change request withdrawn');
    },
    onError: onChangeError('The change request was not withdrawn'),
  });
}

export function useApproveChange(orgSlug: string) {
  const refresh = useRefresh(orgSlug);
  return useMutation({
    mutationFn: ({ projectId, id, comment }: Act & { comment: string }) => changesApi.approve(orgSlug, projectId, id, comment.trim()),
    onSuccess: (cr) => {
      refresh(cr);
      const push = cr.metadata?.treasury?.status;
      if (push === 'failed') toast.warning('Approved, but treasury did not take the budget. Retry the push from the request.');
      else toast.success(push === 'submitted' ? 'Approved. The budget went to treasury for its own approval.' : 'Change approved');
    },
    onError: onChangeError('The change was not approved'),
  });
}

export function useRejectChange(orgSlug: string) {
  const refresh = useRefresh(orgSlug);
  return useMutation({
    mutationFn: ({ projectId, id, comment }: Act & { comment: string }) => changesApi.reject(orgSlug, projectId, id, comment.trim()),
    onSuccess: (cr) => {
      refresh(cr);
      toast.success('Change rejected');
    },
    onError: onChangeError('The change was not rejected'),
  });
}

export function usePushBudget(orgSlug: string) {
  const refresh = useRefresh(orgSlug);
  return useMutation({
    mutationFn: ({ projectId, id }: Act) => changesApi.pushBudget(orgSlug, projectId, id),
    onSuccess: (cr) => {
      refresh(cr);
      if (cr.metadata?.treasury?.status === 'failed') toast.error(cr.metadata.treasury.error || 'Treasury did not take the budget again.');
      else toast.success('The budget went to treasury');
    },
    onError: onChangeError('The budget was not sent'),
  });
}
