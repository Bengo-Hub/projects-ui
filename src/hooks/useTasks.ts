'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tasksApi, type CreateTaskInput, type AddDependencyInput } from '@/lib/api/tasks';

const KEY = 'tasks';
const GANTT_KEY = 'gantt';

export function useTasks(orgSlug: string, projectId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, params],
    queryFn: () => tasksApi.list(orgSlug, projectId, params),
    enabled: !!orgSlug && !!projectId,
  });
}

/** Monthly task flow; pass projectId for one project, omit it for the whole tenant. */
export function useTaskTrend(orgSlug: string, projectId?: string, months = 6) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'trend', projectId ?? 'all', months],
    queryFn: () => tasksApi.trend(orgSlug, { project_id: projectId, months }),
    enabled: !!orgSlug,
    staleTime: 5 * 60_000,
  });
}

export function useTask(orgSlug: string, projectId: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, id],
    queryFn: () => tasksApi.get(orgSlug, projectId, id),
    enabled: !!orgSlug && !!projectId && !!id,
  });
}

export function useGanttData(orgSlug: string, projectId: string) {
  return useQuery({
    queryKey: [GANTT_KEY, orgSlug, projectId],
    queryFn: () => tasksApi.gantt(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });
}

export function useCreateTask(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(orgSlug, projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      toast.success('Task created');
    },
    onError: () => toast.error('Failed to create task'),
  });
}

export function useUpdateTask(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTaskInput> }) =>
      tasksApi.update(orgSlug, projectId, id, data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, id] });
      toast.success('Task updated');
    },
    onError: () => toast.error('Failed to update task'),
  });
}

export function useDeleteTask(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(orgSlug, projectId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      toast.success('Task deleted');
    },
    onError: () => toast.error('Failed to delete task'),
  });
}

export function useAddDependency(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddDependencyInput) =>
      tasksApi.addDependency(orgSlug, projectId, taskId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, taskId] });
      toast.success('Dependency added');
    },
    onError: () => toast.error('Failed to add dependency'),
  });
}

export function useRemoveDependency(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (depId: string) => tasksApi.removeDependency(orgSlug, projectId, taskId, depId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, taskId] });
      toast.success('Dependency removed');
    },
    onError: () => toast.error('Failed to remove dependency'),
  });
}
