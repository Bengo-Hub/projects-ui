import { apiClient } from './client';
import type { Project, PaginatedResponse, ProjectSummary } from '@/types';

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  currency?: string;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface ListProjectsParams {
  status?: string;
  page?: number;
  page_size?: number;
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}/projects`;
}

export const projectsApi = {
  list: (orgSlug: string, params?: ListProjectsParams) =>
    apiClient.get<PaginatedResponse<Project>>(base(orgSlug), params as Record<string, unknown>),
  get: (orgSlug: string, id: string) =>
    apiClient.get<Project>(`${base(orgSlug)}/${id}`),
  create: (orgSlug: string, body: CreateProjectInput) =>
    apiClient.post<Project>(base(orgSlug), body),
  update: (orgSlug: string, id: string, body: UpdateProjectInput) =>
    apiClient.put<Project>(`${base(orgSlug)}/${id}`, body),
  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/${id}`),
  summary: (orgSlug: string, id: string) =>
    apiClient.get<ProjectSummary>(`${base(orgSlug)}/${id}/summary`),
};
