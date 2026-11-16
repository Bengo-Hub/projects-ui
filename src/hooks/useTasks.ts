'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tasksApi, type CreateTaskInput, type AddDependencyInput, type ListTasksParams } from '@/lib/api/tasks';
import { onMutationError } from '@/lib/api/errors';

const KEY = 'tasks';
const GANTT_KEY = 'gantt';
/** Tasks per page of the board and list. */
export const TASK_PAGE_LIMIT = 100;

/**
 * A project's tasks, a page at a time (limit with page). A caller limited to their own tasks gets
 * only the ones assigned to them.
 */
export function useTasks(orgSlug: string, projectId: string, params?: Omit<ListTasksParams, 'limit' | 'page'>) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, 'list', params ?? {}],
    queryFn: ({ pageParam }) => tasksApi.list(orgSlug, projectId, { ...params, limit: TASK_PAGE_LIMIT, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!orgSlug && !!projectId,
  });
  const pages = query.data?.pages ?? [];
  return {
    ...query,
    tasks: pages.flatMap((p) => p.data ?? []),
    total: pages[0]?.total ?? 0,
  };
}

/** Monthly task flow; pass projectId for one project, omit it for the whole tenant (managers only). */
export function useTaskTrend(orgSlug: string, projectId?: string, months = 6, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'trend', projectId ?? 'all', months],
    queryFn: () => tasksApi.trend(orgSlug, { project_id: projectId, months }),
    enabled: enabled && !!orgSlug,
    staleTime: 5 * 60_000,
  });
}

/** A task with its dependencies, its latest 50 comments (oldest first) and its comment count. */
export function useTask(orgSlug: string, projectId: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'detail', id],
    queryFn: () => tasksApi.get(orgSlug, projectId, id),
    enabled: !!orgSlug && !!projectId && !!id,
  });
}

/** The project's plan: up to 2000 tasks with dependencies; truncated says more exist. */
export function useGanttData(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [GANTT_KEY, orgSlug, projectId],
    queryFn: () => tasksApi.gantt(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
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
    onError: onMutationError('Failed to create task'),
  });
}

export function useUpdateTask(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTaskInput> }) =>
      tasksApi.update(orgSlug, projectId, id, data),
    onSuccess: () => {
      // The prefix covers the list pages and the task's own detail.
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      toast.success('Task updated');
    },
    onError: onMutationError('Failed to update task'),
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
    onError: onMutationError('Failed to delete task'),
  });
}

export function useAddDependency(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddDependencyInput) =>
      tasksApi.addDependency(orgSlug, projectId, taskId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, 'detail', taskId] });
      void qc.invalidateQueries({ queryKey: [GANTT_KEY, orgSlug, projectId] });
      toast.success('Dependency added');
    },
    onError: onMutationError('Failed to add dependency'),
  });
}

export function useRemoveDependency(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (depId: string) => tasksApi.removeDependency(orgSlug, projectId, taskId, depId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, 'detail', taskId] });
      void qc.invalidateQueries({ queryKey: [GANTT_KEY, orgSlug, projectId] });
      toast.success('Dependency removed');
    },
    onError: onMutationError('Failed to remove dependency'),
  });
}
