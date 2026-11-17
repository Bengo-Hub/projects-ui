'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { baselinesApi } from '@/lib/api/planning';
import { errorBody, forbiddenKind, isNotFound } from '@/lib/api/errors';

const KEY = 'baselines';

export function baselinesKey(orgSlug: string, projectId: string) {
  return [KEY, orgSlug, projectId] as const;
}

/** The project's baselines, newest first. Needs gantt_chart and projects.baselines.view. */
export function useBaselines(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [...baselinesKey(orgSlug, projectId), 'list'],
    queryFn: () => baselinesApi.list(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 30_000,
  });
}

/** The slips report against a baseline (the latest when none is named). A 404 means no baseline yet. */
export function useSlips(orgSlug: string, projectId: string, baselineId: string, enabled = true) {
  return useQuery({
    queryKey: [...baselinesKey(orgSlug, projectId), 'slips', baselineId],
    queryFn: () => baselinesApi.slips(orgSlug, projectId, baselineId || undefined),
    enabled: enabled && !!orgSlug && !!projectId,
    retry: (n, err) => !isNotFound(err) && n < 2,
  });
}

function onError(fallback: string) {
  return (err: unknown) => {
    if (forbiddenKind(err)) return;
    const text = errorBody(err)?.error;
    toast.error(text ? text.charAt(0).toUpperCase() + text.slice(1) : fallback);
  };
}

export function useSaveBaseline(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; note?: string }) => baselinesApi.save(orgSlug, projectId, body),
    onSuccess: (b) => {
      void qc.invalidateQueries({ queryKey: baselinesKey(orgSlug, projectId) });
      void qc.invalidateQueries({ queryKey: ['gantt', orgSlug, projectId] });
      toast.success(`Baseline "${b.name}" saved with ${b.task_count} ${b.task_count === 1 ? 'task' : 'tasks'}`);
    },
    onError: onError('The baseline was not saved'),
  });
}

export function useDeleteBaseline(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => baselinesApi.delete(orgSlug, projectId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: baselinesKey(orgSlug, projectId) });
      void qc.invalidateQueries({ queryKey: ['gantt', orgSlug, projectId] });
      toast.success('Baseline deleted');
    },
    onError: onError('The baseline was not deleted'),
  });
}
