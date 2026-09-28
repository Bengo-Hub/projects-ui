'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  projectsApi,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ListProjectsParams,
} from '@/lib/api/projects';

const KEY = 'projects';

export function useProjects(orgSlug: string, params?: ListProjectsParams) {
  return useQuery({
    queryKey: [KEY, orgSlug, params],
    queryFn: () => projectsApi.list(orgSlug, params),
    enabled: !!orgSlug,
  });
}

/** Project counts by status across the whole tenant, grouped server side. */
export function useProjectMetrics(orgSlug: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'metrics'],
    queryFn: () => projectsApi.metrics(orgSlug),
    enabled: !!orgSlug,
  });
}

export function useProject(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, id],
    queryFn: () => projectsApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useProjectSummary(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, id, 'summary'],
    queryFn: () => projectsApi.summary(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useCreateProject(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(orgSlug, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      toast.success('Project created');
    },
    onError: () => toast.error('Failed to create project'),
  });
}

export function useUpdateProject(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
      projectsApi.update(orgSlug, id, data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, id] });
      toast.success('Project updated');
    },
    onError: () => toast.error('Failed to update project'),
  });
}

export function useDeleteProject(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(orgSlug, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      toast.success('Project deleted');
    },
    onError: () => toast.error('Failed to delete project'),
  });
}
