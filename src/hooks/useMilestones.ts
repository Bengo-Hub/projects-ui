'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { milestonesApi, type CreateMilestoneInput } from '@/lib/api/milestones';

const KEY = 'milestones';

export function useMilestones(orgSlug: string, projectId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId],
    queryFn: () => milestonesApi.list(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });
}

export function useMilestone(orgSlug: string, projectId: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, id],
    queryFn: () => milestonesApi.get(orgSlug, projectId, id),
    enabled: !!orgSlug && !!projectId && !!id,
  });
}

export function useCreateMilestone(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMilestoneInput) => milestonesApi.create(orgSlug, projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      toast.success('Milestone created');
    },
    onError: () => toast.error('Failed to create milestone'),
  });
}

export function useUpdateMilestone(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateMilestoneInput> }) =>
      milestonesApi.update(orgSlug, projectId, id, data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, id] });
      toast.success('Milestone updated');
    },
    onError: () => toast.error('Failed to update milestone'),
  });
}

export function useDeleteMilestone(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => milestonesApi.delete(orgSlug, projectId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      toast.success('Milestone deleted');
    },
    onError: () => toast.error('Failed to delete milestone'),
  });
}
