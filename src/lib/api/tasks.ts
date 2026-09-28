import { apiClient } from './client';
import type { Task, GanttTask, PaginatedResponse, TaskTrendMonth } from '@/types';

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  progress_pct?: number;
  parent_id?: string;
  wbs_code?: string;
}

export interface AddDependencyInput {
  depends_on_task_id: string;
  dependency_type: string;
}

function base(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/tasks`;
}

export const tasksApi = {
  list: (orgSlug: string, projectId: string, params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<Task>>(base(orgSlug, projectId), params),
  get: (orgSlug: string, projectId: string, id: string) =>
    apiClient.get<Task>(`${base(orgSlug, projectId)}/${id}`),
  create: (orgSlug: string, projectId: string, body: CreateTaskInput) =>
    apiClient.post<Task>(base(orgSlug, projectId), body),
  update: (orgSlug: string, projectId: string, id: string, body: Partial<CreateTaskInput>) =>
    apiClient.put<Task>(`${base(orgSlug, projectId)}/${id}`, body),
  delete: (orgSlug: string, projectId: string, id: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/${id}`),
  addDependency: (orgSlug: string, projectId: string, taskId: string, body: AddDependencyInput) =>
    apiClient.post<void>(`${base(orgSlug, projectId)}/${taskId}/dependencies`, body),
  removeDependency: (orgSlug: string, projectId: string, taskId: string, depId: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/${taskId}/dependencies/${depId}`),
  /** Monthly created, completed and overdue-at-month-end counts, tenant wide or for one project. */
  trend: (orgSlug: string, params?: { project_id?: string; months?: number }) =>
    apiClient
      .get<{ data: TaskTrendMonth[] }>(`/api/v1/${orgSlug}/tasks/trend`, params)
      .then((r) => r.data ?? []),
  gantt: (orgSlug: string, projectId: string) =>
    apiClient.get<GanttTask[]>(`/api/v1/${orgSlug}/projects/${projectId}/gantt`),
};
