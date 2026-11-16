'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  tasksApi,
  type CreateTaskInput,
  type AddDependencyInput,
  type ListTasksParams,
  type RescheduleInput,
  type UpdateTaskInput,
} from '@/lib/api/tasks';
import { errorBody, httpStatusOf, onMutationError } from '@/lib/api/errors';
import { newIdempotencyKey, sendOrQueue } from '@/hooks/useOfflineQueue';
import { metadataWithOp, type ChecklistOp } from '@/lib/work/checklist';
import type { BoardCount, MyWorkBucket, PaginatedResponse, ProjectStatus, Task, TaskDetail } from '@/types';

const KEY = 'tasks';
const GANTT_KEY = 'gantt';
const MY_WORK_KEY = 'my-work';
/** Tasks per page of the list. */
export const TASK_PAGE_LIMIT = 100;
/** Tasks per page of one board column: the board never loads more than this per column at once. */
export const COLUMN_PAGE_LIMIT = 25;

type Pages = InfiniteData<PaginatedResponse<Task>, number>;

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

/** One board column: the tasks in one status, a page at a time. */
export function useBoardColumn(orgSlug: string, projectId: string, status: string, filters?: Pick<ListTasksParams, 'assignee' | 'priority'>) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, 'column', status, filters ?? {}],
    queryFn: ({ pageParam }) => tasksApi.list(orgSlug, projectId, { ...filters, status, limit: COLUMN_PAGE_LIMIT, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!orgSlug && !!projectId && !!status,
  });
  return { ...query, tasks: (query.data?.pages ?? []).flatMap((p) => p.data ?? []) };
}

/** Tasks due inside a window (YYYY-MM-DD, inclusive), for the calendar. */
export function useCalendarTasks(orgSlug: string, projectId: string, range: { due_from: string; due_to: string }) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, 'calendar', range],
    queryFn: ({ pageParam }) => tasksApi.list(orgSlug, projectId, { ...range, limit: TASK_PAGE_LIMIT, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!orgSlug && !!projectId,
  });
  return { ...query, tasks: (query.data?.pages ?? []).flatMap((p) => p.data ?? []) };
}

export function useProjectStatuses(orgSlug: string, projectId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'statuses'],
    queryFn: () => tasksApi.statuses(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
    staleTime: 10 * 60_000,
  });
}

export function useSetStatuses(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (statuses: ProjectStatus[]) => tasksApi.setStatuses(orgSlug, projectId, statuses),
    onSuccess: (data) => {
      qc.setQueryData([KEY, orgSlug, projectId, 'statuses'], [...data].sort((a, b) => a.order - b.order));
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, 'board-counts'] });
      toast.success('Board columns saved');
    },
    onError: onMutationError('The columns could not be saved'),
  });
}

export function useBoardCounts(orgSlug: string, projectId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'board-counts'],
    queryFn: () => tasksApi.boardCounts(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });
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

/** A task with its dependencies and assignees, its latest 50 comments (oldest first) and its comment count. */
export function useTask(orgSlug: string, projectId: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'detail', id],
    queryFn: () => tasksApi.get(orgSlug, projectId, id),
    enabled: !!orgSlug && !!projectId && !!id,
    staleTime: 30_000,
  });
}

/** Subtasks per page in the drawer. */
export const SUBTASK_PAGE_LIMIT = 25;

/**
 * Subtasks of a task through ?parent_id (indexed on the API), a page at a time; it runs only while
 * the subtasks section is open.
 */
export function useSubtasks(orgSlug: string, projectId: string, parentId: string, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, 'subtasks', parentId],
    queryFn: ({ pageParam }) => tasksApi.list(orgSlug, projectId, { parent_id: parentId, limit: SUBTASK_PAGE_LIMIT, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!orgSlug && !!projectId && !!parentId,
  });
  const pages = query.data?.pages ?? [];
  return { ...query, tasks: pages.flatMap((p) => p.data ?? []), total: pages[0]?.total ?? 0 };
}

/** The project's plan: up to 2000 tasks with dependencies and the critical path. */
export function useGanttData(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [GANTT_KEY, orgSlug, projectId],
    queryFn: () => tasksApi.gantt(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
  });
}

export function useMyWork(orgSlug: string, bucket: MyWorkBucket, tz: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: [MY_WORK_KEY, orgSlug, 'list', bucket, tz],
    queryFn: ({ pageParam }) => tasksApi.myWork(orgSlug, { bucket, tz, limit: 50, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!orgSlug,
  });
  return { ...query, tasks: (query.data?.pages ?? []).flatMap((p) => p.data ?? []) };
}

export function useMyWorkCounts(orgSlug: string, tz: string) {
  return useQuery({
    queryKey: [MY_WORK_KEY, orgSlug, 'counts', tz],
    queryFn: () => tasksApi.myWorkCounts(orgSlug, tz),
    enabled: !!orgSlug,
  });
}

export function useCreateTask(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(orgSlug, projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [GANTT_KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [MY_WORK_KEY, orgSlug] });
      toast.success('Task created');
    },
    onError: onMutationError('Failed to create task'),
  });
}

export function useUpdateTask(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) => tasksApi.update(orgSlug, projectId, id, data),
    onSuccess: () => {
      // The prefix covers the board columns, list pages and the task's own detail.
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [GANTT_KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [MY_WORK_KEY, orgSlug] });
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
      void qc.invalidateQueries({ queryKey: [GANTT_KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [MY_WORK_KEY, orgSlug] });
      toast.success('Task deleted');
    },
    onError: onMutationError('Failed to delete task'),
  });
}

function moveInColumns(qc: ReturnType<typeof useQueryClient>, orgSlug: string, projectId: string, task: Task, to: string) {
  const prefix = [KEY, orgSlug, projectId, 'column'];
  const moved = { ...task, status: to };
  for (const [key, data] of qc.getQueriesData<Pages>({ queryKey: prefix })) {
    if (!data) continue;
    const colStatus = key[4] as string;
    if (colStatus === task.status) {
      qc.setQueryData<Pages>(key, {
        ...data,
        pages: data.pages.map((p) => ({ ...p, data: (p.data ?? []).filter((t) => t.id !== task.id), total: Math.max(0, p.total - 1) })),
      });
    } else if (colStatus === to) {
      qc.setQueryData<Pages>(key, {
        ...data,
        pages: data.pages.map((p, i) => (i === 0 ? { ...p, data: [moved, ...(p.data ?? []).filter((t) => t.id !== task.id)], total: p.total + 1 } : p)),
      });
    }
  }
  qc.setQueryData<BoardCount[]>([KEY, orgSlug, projectId, 'board-counts'], (counts) => {
    if (!counts) return counts;
    const next = counts.map((c) => (c.status === task.status ? { ...c, count: Math.max(0, c.count - 1) } : c.status === to ? { ...c, count: c.count + 1 } : c));
    return next.some((c) => c.status === to) ? next : [...next, { status: to, count: 1 }];
  });
  qc.setQueryData<TaskDetail>([KEY, orgSlug, projectId, 'detail', task.id], (d) => (d ? { ...d, status: to } : d));
}

/**
 * Moves a task to another status: the board updates at once and rolls back on a refusal. Each move
 * carries its own Idempotency-Key, so a replay after a lost answer or from the offline queue
 * changes nothing twice. Offline the move is queued and sent on reconnect.
 */
export function useChangeStatus(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ task, to, key }: { task: Task; to: string; key?: string }) => {
      const k = key ?? newIdempotencyKey();
      return sendOrQueue({ kind: 'status', key: k, orgSlug, projectId, taskId: task.id, status: to }, () =>
        tasksApi.changeStatus(orgSlug, projectId, task.id, to, k),
      );
    },
    onMutate: async ({ task, to }) => {
      await qc.cancelQueries({ queryKey: [KEY, orgSlug, projectId] });
      const snapshot = qc.getQueriesData({ queryKey: [KEY, orgSlug, projectId] });
      moveInColumns(qc, orgSlug, projectId, task, to);
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      onMutationError('The task could not be moved')(err);
    },
    onSuccess: (res) => {
      if (res.queued) toast.info('You are offline. The move is saved here and will be sent when you reconnect.', { id: 'offline-queued' });
    },
    onSettled: (res) => {
      if (res && res.queued) return;
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [GANTT_KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [MY_WORK_KEY, orgSlug] });
    },
  });
}

/** The tasks a 409 schedule_conflict names, or null for any other error. */
export function scheduleConflict(err: unknown): string[] | null {
  if (httpStatusOf(err) !== 409) return null;
  const body = errorBody(err) as { code?: string; blocking_task_ids?: string[] } | undefined;
  return body?.code === 'schedule_conflict' ? body.blocking_task_ids ?? [] : null;
}

/**
 * Drag reschedule. A 409 schedule_conflict is left to the caller (onConflict), which names the
 * blocking tasks; other errors toast.
 */
export function useReschedule(orgSlug: string, projectId: string, onConflict?: (blocking: string[]) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dates }: { id: string; dates: RescheduleInput }) => tasksApi.reschedule(orgSlug, projectId, id, dates),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [GANTT_KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: [MY_WORK_KEY, orgSlug] });
    },
    onError: (err) => {
      const blocking = scheduleConflict(err);
      if (blocking && onConflict) return onConflict(blocking);
      onMutationError('The dates could not be changed')(err);
    },
  });
}

/**
 * Sends one checklist operation (add, toggle, rename, remove, reorder). The drawer shows it at
 * once; the API applies it under the task row lock, so two people ticking different items both
 * keep their tick. Offline each operation queues in order with its own Idempotency-Key.
 */
export function useChecklistOp(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  const detailKey = [KEY, orgSlug, projectId, 'detail', taskId];
  return useMutation({
    networkMode: 'always',
    mutationFn: (op: ChecklistOp) => {
      const key = newIdempotencyKey();
      return sendOrQueue({ kind: 'checklist', key, orgSlug, projectId, taskId, op }, () =>
        tasksApi.checklist(orgSlug, projectId, taskId, op, key),
      );
    },
    onMutate: async (op) => {
      await qc.cancelQueries({ queryKey: detailKey });
      const before = qc.getQueryData<TaskDetail>(detailKey);
      qc.setQueryData<TaskDetail>(detailKey, (d) => (d ? { ...d, metadata: metadataWithOp(d.metadata, op) } : d));
      return { before };
    },
    onError: (err, _op, ctx) => {
      if (ctx?.before) qc.setQueryData(detailKey, ctx.before);
      onMutationError('The checklist could not be saved')(err);
    },
    onSuccess: (res) => {
      if (res.queued) {
        toast.info('You are offline. The checklist change is saved here and will be sent when you reconnect.', { id: 'offline-queued' });
        return;
      }
      // The answer is the task with the whole checklist as the API now holds it.
      qc.setQueryData<TaskDetail>(detailKey, (d) => (d ? { ...d, metadata: res.result.task.metadata } : d));
    },
    onSettled: (res) => {
      if (res && res.queued) return;
      void qc.invalidateQueries({ queryKey: detailKey });
    },
  });
}

export function useAddDependency(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddDependencyInput) => tasksApi.addDependency(orgSlug, projectId, taskId, input),
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
