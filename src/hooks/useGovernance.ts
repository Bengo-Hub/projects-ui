'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { governanceApi } from '@/lib/api/governance';
import { errorBody, forbiddenKind } from '@/lib/api/errors';
import { governanceErrorText } from '@/lib/governance/logic';
import type { DecisionInput, DecisionStatus, GovernanceRoleInput, RaciInput } from '@/types/governance';

const KEY = 'governance';

/** A refused governance write in plain words; a plan or permission 403 was already explained. */
function onGovernanceError(fallback: string) {
  return (err: unknown) => {
    const body = errorBody(err);
    if (forbiddenKind(err) && body?.code !== 'not_approver') return;
    toast.error(governanceErrorText(body?.code, body?.error, fallback), { id: `governance-${body?.code ?? 'error'}` });
  };
}

function useRefresh(orgSlug: string, projectId: string, part: 'roles' | 'raci' | 'decisions') {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, part] });
}

// Governance roles.

export function useGovernanceRoles(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'roles'],
    queryFn: () => governanceApi.roles(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 30_000,
  });
}

export function useSaveGovernanceRole(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId, 'roles');
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: GovernanceRoleInput }) =>
      id ? governanceApi.updateRole(orgSlug, projectId, id, body) : governanceApi.createRole(orgSlug, projectId, body),
    onSuccess: (_, v) => {
      refresh();
      toast.success(v.id ? 'Seat updated' : 'Seat added');
    },
    onError: onGovernanceError('The seat was not saved'),
  });
}

export function useDeleteGovernanceRole(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId, 'roles');
  return useMutation({
    mutationFn: (id: string) => governanceApi.deleteRole(orgSlug, projectId, id),
    onSuccess: () => {
      refresh();
      toast.success('Seat removed');
    },
    onError: onGovernanceError('The seat was not removed'),
  });
}

// RACI matrix.

export function useRaci(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'raci'],
    queryFn: () => governanceApi.raci(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 30_000,
  });
}

export function useSaveRaci(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId, 'raci');
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: RaciInput }) =>
      id ? governanceApi.updateRaci(orgSlug, projectId, id, body) : governanceApi.createRaci(orgSlug, projectId, body),
    onSuccess: (_, v) => {
      refresh();
      toast.success(v.id ? 'Row updated' : 'Row added');
    },
    onError: onGovernanceError('The row was not saved'),
  });
}

export function useDeleteRaci(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId, 'raci');
  return useMutation({
    mutationFn: (id: string) => governanceApi.deleteRaci(orgSlug, projectId, id),
    onSuccess: () => {
      refresh();
      toast.success('Row removed');
    },
    onError: onGovernanceError('The row was not removed'),
  });
}

// Decision log.

/** The log, newest number first, a page at a time. */
export function useDecisions(orgSlug: string, projectId: string, status: DecisionStatus | '', enabled = true) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, 'decisions', status],
    queryFn: ({ pageParam }) => governanceApi.decisions(orgSlug, projectId, { limit: 20, page: pageParam, ...(status ? { status } : {}) }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 15_000,
  });
  return { ...query, items: (query.data?.pages ?? []).flatMap((p) => p.data ?? []), total: query.data?.pages[0]?.total ?? 0 };
}

export function useSaveDecision(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId, 'decisions');
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: DecisionInput }) =>
      id ? governanceApi.updateDecision(orgSlug, projectId, id, body) : governanceApi.logDecision(orgSlug, projectId, body),
    onSuccess: (d, v) => {
      refresh();
      if (v.id) toast.success('Decision updated');
      else toast.success(d.status === 'proposed' ? 'Decision logged. It waits for the approvers.' : 'Decision logged as approved');
    },
    onError: onGovernanceError('The decision was not saved'),
  });
}

export function useDecide(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId, 'decisions');
  return useMutation({
    mutationFn: ({ id, decision, comment }: { id: string; decision: 'approve' | 'reject'; comment: string }) =>
      governanceApi.decide(orgSlug, projectId, id, { decision, comment: comment.trim() }),
    onSuccess: (_, v) => {
      refresh();
      toast.success(v.decision === 'approve' ? 'Your approval is recorded' : 'Your rejection is recorded');
    },
    onError: onGovernanceError('Your answer was not saved'),
  });
}

export function useSupersedeDecision(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId, 'decisions');
  return useMutation({
    mutationFn: ({ id, supersededBy }: { id: string; supersededBy?: string }) => governanceApi.supersede(orgSlug, projectId, id, supersededBy),
    onSuccess: () => {
      refresh();
      toast.success('Decision marked as superseded');
    },
    onError: onGovernanceError('The decision was not superseded'),
  });
}

export function useDeleteDecision(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId, 'decisions');
  return useMutation({
    mutationFn: (id: string) => governanceApi.deleteDecision(orgSlug, projectId, id),
    onSuccess: () => {
      refresh();
      toast.success('Decision deleted');
    },
    onError: onGovernanceError('The decision was not deleted'),
  });
}
