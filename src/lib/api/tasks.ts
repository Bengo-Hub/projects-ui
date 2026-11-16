import { apiClient } from './client';
import type { ChecklistOp } from '@/lib/work/checklist';
import type {
  BoardCount,
  GanttResponse,
  MyWorkBucket,
  MyWorkCounts,
  PaginatedResponse,
  ProjectStatus,
  Task,
  TaskDetail,
  TaskTrendMonth,
} from '@/types';

/** One page of a project's tasks: limit (up to 500) with a 1-based page, plus filters. */
export interface ListTasksParams {
  limit?: number;
  page?: number;
  /** One board column. */
  status?: string;
  priority?: string;
  /** "me" or a user id; matches any assignee. */
  assignee?: string;
  /** Inclusive YYYY-MM-DD bounds on the due date (calendar). */
  due_from?: string;
  due_to?: string;
  /** One task's subtasks. */
  parent_id?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  /** Project members only; the first is the primary assignee. */
  assignee_ids?: string[];
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  progress_pct?: number;
  parent_id?: string;
  wbs_code?: string;
  metadata?: Record<string, unknown>;
}

/** A PUT: assignee_ids replaces the assignees ([] clears); "" clears a date. */
export type UpdateTaskInput = Partial<CreateTaskInput>;

export interface AddDependencyInput {
  depends_on_task_id: string;
  dependency_type: string;
}

/** PATCH dates: "" clears a date. */
export interface RescheduleInput {
  start_date?: string;
  due_date?: string;
}

export interface MyWorkParams {
  bucket: MyWorkBucket;
  tz: string;
  limit?: number;
  page?: number;
}

function base(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/tasks`;
}

export const tasksApi = {
  list: (orgSlug: string, projectId: string, params?: ListTasksParams) =>
    apiClient.get<PaginatedResponse<Task>>(base(orgSlug, projectId), params as Record<string, unknown>),
  /** The task with edges.dependencies and edges.assignees, its latest 50 comments oldest first and comments_total. */
  get: (orgSlug: string, projectId: string, id: string) =>
    apiClient.get<TaskDetail>(`${base(orgSlug, projectId)}/${id}`),
  create: (orgSlug: string, projectId: string, body: CreateTaskInput) =>
    apiClient.post<Task>(base(orgSlug, projectId), body),
  update: (orgSlug: string, projectId: string, id: string, body: UpdateTaskInput) =>
    apiClient.put<Task>(`${base(orgSlug, projectId)}/${id}`, body),
  delete: (orgSlug: string, projectId: string, id: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/${id}`),
  /**
   * Moves a task to another status. The Idempotency-Key (one per user action) makes a replay after
   * a lost answer change nothing; replayed is true for such a duplicate.
   */
  changeStatus: (orgSlug: string, projectId: string, id: string, status: string, idempotencyKey: string) =>
    apiClient
      .patchWithHeaders<Task>(`${base(orgSlug, projectId)}/${id}/status`, { status }, { 'Idempotency-Key': idempotencyKey })
      .then((r) => ({ task: r.data, replayed: r.headers['idempotent-replayed'] === 'true' })),
  /**
   * One checklist operation, applied under the task row lock so concurrent ticks never undo each
   * other. The Idempotency-Key works as for changeStatus. Answers the task.
   */
  checklist: (orgSlug: string, projectId: string, id: string, op: ChecklistOp, idempotencyKey: string) =>
    apiClient
      .patchWithHeaders<Task>(`${base(orgSlug, projectId)}/${id}/checklist`, op, { 'Idempotency-Key': idempotencyKey })
      .then((r) => ({ task: r.data, replayed: r.headers['idempotent-replayed'] === 'true' })),
  /** Drag reschedule; a broken finish-to-start link answers 409 schedule_conflict with blocking_task_ids. */
  reschedule: (orgSlug: string, projectId: string, id: string, body: RescheduleInput) =>
    apiClient.patch<Task>(`${base(orgSlug, projectId)}/${id}/dates`, body),
  addDependency: (orgSlug: string, projectId: string, taskId: string, body: AddDependencyInput) =>
    apiClient.post<void>(`${base(orgSlug, projectId)}/${taskId}/dependencies`, body),
  removeDependency: (orgSlug: string, projectId: string, taskId: string, depId: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/${taskId}/dependencies/${depId}`),
  /** Monthly created, completed and overdue-at-month-end counts, tenant wide or for one project. */
  trend: (orgSlug: string, params?: { project_id?: string; months?: number }) =>
    apiClient
      .get<{ data: TaskTrendMonth[] }>(`/api/v1/${orgSlug}/tasks/trend`, params)
      .then((r) => r.data ?? []),
  /** Up to 2000 tasks with dependencies and the critical flag; truncated says the project has more. */
  gantt: (orgSlug: string, projectId: string) =>
    apiClient.get<GanttResponse>(`/api/v1/${orgSlug}/projects/${projectId}/gantt`),

  statuses: (orgSlug: string, projectId: string) =>
    apiClient
      .get<{ data: ProjectStatus[] }>(`/api/v1/${orgSlug}/projects/${projectId}/statuses`)
      .then((r) => [...(r.data ?? [])].sort((a, b) => a.order - b.order)),
  /** Replaces the board columns; needs a done status, and a status tasks still hold cannot go. */
  setStatuses: (orgSlug: string, projectId: string, statuses: ProjectStatus[]) =>
    apiClient
      .put<{ data: ProjectStatus[] }>(`/api/v1/${orgSlug}/projects/${projectId}/statuses`, { statuses })
      .then((r) => r.data ?? []),
  boardCounts: (orgSlug: string, projectId: string) =>
    apiClient
      .get<{ data: BoardCount[] }>(`/api/v1/${orgSlug}/projects/${projectId}/board-counts`)
      .then((r) => r.data ?? []),

  /** Open tasks assigned to me across projects, soonest due first, rows carry edges.project. */
  myWork: (orgSlug: string, params: MyWorkParams) =>
    apiClient.get<PaginatedResponse<Task>>(`/api/v1/${orgSlug}/my-work`, params as unknown as Record<string, unknown>),
  myWorkCounts: (orgSlug: string, tz: string) =>
    apiClient.get<{ data: MyWorkCounts }>(`/api/v1/${orgSlug}/my-work/counts`, { tz }).then((r) => r.data),
};
