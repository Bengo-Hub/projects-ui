'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  projectsApi,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ListProjectsParams,
} from '@/lib/api/projects';
import { onMutationError } from '@/lib/api/errors';

const KEY = 'projects';

/** The projects the caller may see: every project with projects.projects.manage, else their own. */
export function useProjects(orgSlug: string, params?: ListProjectsParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, params],
    queryFn: () => projectsApi.list(orgSlug, params),
    enabled: enabled && !!orgSlug,
  });
}

/** Project counts by status over the projects the caller may see, grouped server side. */
export function useProjectMetrics(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'metrics'],
    queryFn: () => projectsApi.metrics(orgSlug),
    enabled: enabled && !!orgSlug,
  });
}

/** One project with its members and milestones (tasks come from the tasks list). */
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
    onError: onMutationError('Failed to create project'),
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
      // Commercial terms feed the financials view.
      void qc.invalidateQueries({ queryKey: ['financials', orgSlug] });
      toast.success('Project updated');
    },
    onError: onMutationError('Failed to update project'),
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
    onError: onMutationError('Failed to delete project'),
  });
}
