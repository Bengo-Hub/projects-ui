'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { automationApi } from '@/lib/api/planning';
import { onMutationError } from '@/lib/api/errors';
import { normaliseRules, type AutomationRule, type StatusRules } from '@/lib/planning/rules';

const KEY = 'automation';

/** The project's status rules. Read with tasks.view or view_own; needs project_automation. */
export function useStatusRules(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'rules'],
    queryFn: async () => normaliseRules(await automationApi.statusRules(orgSlug, projectId)),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 60_000,
  });
}

export function useSaveStatusRules(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rules: StatusRules) => automationApi.saveStatusRules(orgSlug, projectId, rules),
    onSuccess: (saved) => {
      qc.setQueryData([KEY, orgSlug, projectId, 'rules'], normaliseRules(saved));
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, 'moves'] });
      toast.success('Status rules saved');
    },
    onError: onMutationError('The status rules were not saved'),
  });
}

export function useAutomations(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'automations'],
    queryFn: () => automationApi.automations(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 60_000,
  });
}

export function useSaveAutomations(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (list: AutomationRule[]) => automationApi.saveAutomations(orgSlug, projectId, list),
    onSuccess: (saved) => {
      qc.setQueryData([KEY, orgSlug, projectId, 'automations'], saved);
      toast.success('Automations saved');
    },
    onError: onMutationError('The automations were not saved'),
  });
}

/**
 * Which statuses a task may move to now and why not (GET /task-moves/{taskId}). Runs only with
 * project_automation on the plan, since without it the rules are dormant and the route refuses.
 * Pass an empty taskId to keep it idle (the board asks once a drag starts).
 */
export function useTaskMoves(orgSlug: string, projectId: string, taskId: string) {
  const automation = useFeature('project_automation');
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'moves', taskId],
    queryFn: () => automationApi.taskMoves(orgSlug, projectId, taskId),
    enabled: automation && !!orgSlug && !!projectId && !!taskId,
    staleTime: 15_000,
  });
}
