'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { risksApi, type RiskInput, type RiskListParams } from '@/lib/api/planning';
import { onMutationError } from '@/lib/api/errors';

const KEY = 'risks';

/** A project's risk register, highest score first. Risks are on every plan; needs risks.view. */
export function useRisks(orgSlug: string, projectId: string, params: RiskListParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'list', params],
    queryFn: () => risksApi.list(orgSlug, projectId, params),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 30_000,
  });
}

/** Risk counts by likelihood and impact; closed and occurred ones only with all. */
export function useRiskHeatMap(orgSlug: string, projectId: string, all: boolean, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'heatmap', all],
    queryFn: () => risksApi.heatmap(orgSlug, projectId, all),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 30_000,
  });
}

function useRefresh(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
}

export function useCreateRisk(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId);
  return useMutation({
    mutationFn: (body: RiskInput) => risksApi.create(orgSlug, projectId, body),
    onSuccess: () => {
      refresh();
      toast.success('Risk added');
    },
    onError: onMutationError('The risk was not saved'),
  });
}

export function useUpdateRisk(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RiskInput }) => risksApi.update(orgSlug, projectId, id, body),
    onSuccess: () => {
      refresh();
      toast.success('Risk updated');
    },
    onError: onMutationError('The risk was not saved'),
  });
}

export function useDeleteRisk(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId);
  return useMutation({
    mutationFn: (id: string) => risksApi.delete(orgSlug, projectId, id),
    onSuccess: () => {
      refresh();
      toast.success('Risk deleted');
    },
    onError: onMutationError('The risk was not deleted'),
  });
}
