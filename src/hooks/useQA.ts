'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  qaApi,
  qaErrorMessage,
  type CreateSessionInput,
  type CreateTemplateInput,
  type InviteInput,
  type ListParams,
  type UpdateTemplateInput,
} from '@/lib/api/qa';
import { chunk, MAX_CRITERIA_PER_CALL, qaAllowed } from '@/lib/qa/logic';
import { useMe } from '@/hooks/useMe';
import type { QACriterionInput, QAVerdictInput } from '@/types/qa';

const KEY = 'qa';

/** QA access for the signed-in user, read the same way projects-api's gates read it. */
export function useQAPermissions() {
  const { user, isLoading } = useMe();
  return {
    isLoading,
    user,
    isPlatformOwner: !!user?.isPlatformOwner,
    canView: qaAllowed(user, 'view'),
    canRun: qaAllowed(user, 'run'),
    canManage: qaAllowed(user, 'manage'),
  };
}

function onFail(fallback: string) {
  return (err: unknown) => toast.error(qaErrorMessage(err, fallback));
}

export function useQAFeatures(orgSlug: string, service?: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'features', service ?? ''],
    queryFn: () => qaApi.catalogFeatures(orgSlug, service),
    enabled: !!orgSlug && enabled,
    staleTime: 10 * 60 * 1000,
  });
}

// Templates

export function useQATemplates(orgSlug: string, params?: ListParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'templates', params],
    queryFn: () => qaApi.listTemplates(orgSlug, params),
    enabled: !!orgSlug && enabled,
  });
}

export function useQATemplate(orgSlug: string, id: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'template', id],
    queryFn: () => qaApi.getTemplate(orgSlug, id),
    enabled: !!orgSlug && !!id && enabled,
  });
}

export function useCreateQATemplate(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => qaApi.createTemplate(orgSlug, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'templates'] });
      toast.success('Template created');
    },
    onError: onFail('Could not create the template'),
  });
}

export function useUpdateQATemplate(orgSlug: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTemplateInput) => qaApi.updateTemplate(orgSlug, id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'templates'] });
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'template', id] });
      toast.success('Template saved');
    },
    onError: onFail('Could not save the template'),
  });
}

/** Adds criteria in calls of at most 500 (the API limit). Each call is its own transaction. */
export function useAddQACriteria(orgSlug: string, templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (criteria: QACriterionInput[]) => {
      let added = 0;
      for (const part of chunk(criteria, MAX_CRITERIA_PER_CALL)) {
        const res = await qaApi.addCriteria(orgSlug, templateId, part);
        added += res.data?.length ?? part.length;
      }
      return added;
    },
    onSuccess: (added) => toast.success(added === 1 ? 'Criterion added' : `${added} criteria added`),
    onError: onFail('Could not add the criteria'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'template', templateId] });
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'templates'] });
    },
  });
}

export function useUpdateQACriterion(orgSlug: string, templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: QACriterionInput }) =>
      qaApi.updateCriterion(orgSlug, templateId, id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'template', templateId] });
      toast.success('Criterion saved');
    },
    onError: onFail('Could not save the criterion'),
  });
}

export function useDeleteQACriterion(orgSlug: string, templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => qaApi.deleteCriterion(orgSlug, templateId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'template', templateId] });
      toast.success('Criterion removed');
    },
    onError: onFail('Could not remove the criterion'),
  });
}

// Sessions

export function useQASessions(orgSlug: string, params?: ListParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'sessions', params],
    queryFn: () => qaApi.listSessions(orgSlug, params),
    enabled: !!orgSlug && enabled,
  });
}

export function useQASession(orgSlug: string, id: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'session', id],
    queryFn: () => qaApi.getSession(orgSlug, id),
    enabled: !!orgSlug && !!id && enabled,
    refetchOnWindowFocus: true,
  });
}

/** Board data: the outcome, current results, defects and invites, refreshed on focus. */
export function useQASessionBoard(orgSlug: string, id: string, enabled = true) {
  const on = !!orgSlug && !!id && enabled;
  const opts = { enabled: on, refetchOnWindowFocus: true, staleTime: 15 * 1000 } as const;
  return {
    outcome: useQuery({ queryKey: [KEY, orgSlug, 'session', id, 'outcome'], queryFn: () => qaApi.outcome(orgSlug, id), ...opts }),
    results: useQuery({ queryKey: [KEY, orgSlug, 'session', id, 'results'], queryFn: () => qaApi.listResults(orgSlug, id), ...opts }),
    defects: useQuery({ queryKey: [KEY, orgSlug, 'session', id, 'defects'], queryFn: () => qaApi.listDefects(orgSlug, id), ...opts }),
    invites: useQuery({ queryKey: [KEY, orgSlug, 'session', id, 'invites'], queryFn: () => qaApi.listInvites(orgSlug, id), ...opts }),
  };
}

export function useCreateQASession(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSessionInput) => qaApi.createSession(orgSlug, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'sessions'] });
      toast.success('Session created');
    },
    onError: onFail('Could not create the session'),
  });
}

function useSessionMutation<TVars>(orgSlug: string, id: string, fn: (v: TVars) => Promise<unknown>, ok: string, fail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'session', id] });
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'sessions'] });
      if (ok) toast.success(ok);
    },
    onError: onFail(fail),
  });
}

export function useOpenQASession(orgSlug: string, id: string) {
  return useSessionMutation(orgSlug, id, () => qaApi.openSession(orgSlug, id), 'Session opened', 'Could not open the session');
}

export function useCloseQASession(orgSlug: string, id: string) {
  return useSessionMutation(orgSlug, id, () => qaApi.closeSession(orgSlug, id), 'Session closed and report stored', 'Could not close the session');
}

export function useDecideQASession(orgSlug: string, id: string) {
  return useSessionMutation(
    orgSlug,
    id,
    (v: { decision: 'accepted' | 'rejected'; reason: string }) => qaApi.decide(orgSlug, id, v.decision, v.reason),
    'Decision recorded',
    'Could not record the decision',
  );
}

export function useInviteQA(orgSlug: string, id: string) {
  return useSessionMutation(orgSlug, id, (invites: InviteInput[]) => qaApi.invite(orgSlug, id, invites), 'Invitations sent', 'Could not send the invitations');
}

export function useRevokeQAInvite(orgSlug: string, id: string) {
  return useSessionMutation(orgSlug, id, (inviteId: string) => qaApi.revokeInvite(orgSlug, id, inviteId), 'Access revoked', 'Could not revoke the access');
}

export function useRaiseQADefect(orgSlug: string, id: string) {
  return useSessionMutation(orgSlug, id, (criterionId: string) => qaApi.raiseDefect(orgSlug, id, criterionId), '', 'Could not raise the ticket');
}

/** A verdict recorded by a signed-in team member (projects.qa.run), as themselves. */
export function useRecordQAResult(orgSlug: string, id: string) {
  return useSessionMutation(
    orgSlug,
    id,
    (v: { criterionId: string; verdict: QAVerdictInput }) => qaApi.recordResult(orgSlug, id, v.criterionId, v.verdict),
    'Verdict saved',
    'Could not save the verdict',
  );
}
