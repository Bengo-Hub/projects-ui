'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api/ai';
import { tasksApi } from '@/lib/api/tasks';
import { risksApi } from '@/lib/api/planning';
import { errorBody, httpStatusOf } from '@/lib/api/errors';
import { aiErrorInfo, type AIErrorInfo, type RiskCreateBody, type TaskCreateBody } from '@/lib/ai/drafts';

// AI assistant (sprint 10). Each ask carries its own request key in the mutation variables, so
// "Try again" (mutate(variables)) repeats the same key and is never charged twice, while a new ask
// gets a new key. Errors show inline in the panel that asked, not as toasts.

/** The panel message for a failed ask. */
export function aiError(err: unknown): AIErrorInfo | null {
  if (!err) return null;
  return aiErrorInfo(httpStatusOf(err), errorBody(err) as { code?: string; error?: string; reason?: string } | undefined);
}

export function useTaskBreakdown(orgSlug: string, projectId: string) {
  return useMutation({
    mutationFn: (v: { brief: string; parentTaskId?: string; key: string }) =>
      aiApi.taskBreakdown(orgSlug, projectId, { brief: v.brief, ...(v.parentTaskId ? { parent_task_id: v.parentTaskId } : {}) }, v.key),
  });
}

export function useStatusSummary(orgSlug: string, projectId: string) {
  return useMutation({
    mutationFn: (v: { periodDays: number; key: string }) => aiApi.statusSummary(orgSlug, projectId, { period_days: v.periodDays }, v.key),
  });
}

export function useRiskSuggestions(orgSlug: string, projectId: string) {
  return useMutation({
    mutationFn: (v: { key: string }) => aiApi.riskSuggestions(orgSlug, projectId, v.key),
  });
}

export function useEstimates(orgSlug: string, projectId: string) {
  return useMutation({
    mutationFn: (v: { taskIds: string[]; key: string }) => aiApi.estimates(orgSlug, projectId, v.taskIds, v.key),
  });
}

export function useAISearch(orgSlug: string) {
  return useMutation({
    mutationFn: (v: { query: string; key: string }) => aiApi.search(orgSlug, v.query, v.key),
  });
}

/** The organisation's AI usage (projects.ai.view). */
export function useAIUsage(orgSlug: string, days: number, offset: number, enabled = true) {
  return useQuery({
    queryKey: ['ai-usage', orgSlug, days, offset],
    queryFn: () => aiApi.usage(orgSlug, { days, limit: 50, offset }),
    enabled: enabled && !!orgSlug,
    staleTime: 30_000,
  });
}

/**
 * Saves the accepted task drafts through the ordinary task create, one after another so the order
 * holds. A failure stops the run and reports how many were added before it.
 */
export function useAcceptDraftTasks(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bodies: TaskCreateBody[]) => {
      let added = 0;
      try {
        for (const b of bodies) {
          await tasksApi.create(orgSlug, projectId, b);
          added++;
        }
      } catch (err) {
        throw Object.assign(err as object, { added });
      }
      return added;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['gantt', orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['my-work', orgSlug] });
    },
    onSuccess: (n) => toast.success(n === 1 ? '1 task added' : `${n} tasks added`),
    onError: (err) => {
      const added = (err as { added?: number }).added ?? 0;
      toast.error(added > 0 ? `${added} added, then a task was not saved. The rest are still here to retry.` : 'The tasks were not saved.');
    },
  });
}

/** Saves the accepted risk drafts through the ordinary risk create. */
export function useAcceptDraftRisks(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bodies: RiskCreateBody[]) => {
      let added = 0;
      try {
        for (const b of bodies) {
          await risksApi.create(orgSlug, projectId, b);
          added++;
        }
      } catch (err) {
        throw Object.assign(err as object, { added });
      }
      return added;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['risks', orgSlug, projectId] }),
    onSuccess: (n) => toast.success(n === 1 ? '1 risk added' : `${n} risks added`),
    onError: (err) => {
      const added = (err as { added?: number }).added ?? 0;
      toast.error(added > 0 ? `${added} added, then a risk was not saved.` : 'The risks were not saved.');
    },
  });
}

/** Applies one accepted estimate through the ordinary task update. */
export function useApplyEstimate(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; hours: number }) => tasksApi.update(orgSlug, projectId, v.taskId, { estimated_hours: v.hours }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', orgSlug, projectId] });
      toast.success('Estimate saved');
    },
    onError: () => toast.error('The estimate was not saved.'),
  });
}
