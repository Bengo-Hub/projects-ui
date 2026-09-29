import { apiClient } from './client';
import type { Project, PaginatedResponse, ProjectSummary, ProjectMetrics } from '@/types';

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  currency?: string;
  /** Partial on update: keys sent as null are removed, keys not sent are kept. */
  metadata?: Record<string, unknown>;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

/** A picker row from the CRM (contacts) or treasury (cost centres). */
export interface LookupOption {
  id: string;
  name: string;
  detail?: string;
}

export interface ListProjectsParams {
  status?: string;
  page?: number;
  // Page size: projects-api uses the shared pagination params (limit, page).
  limit?: number;
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}/projects`;
}

export const projectsApi = {
  list: (orgSlug: string, params?: ListProjectsParams) =>
    apiClient.get<PaginatedResponse<Project>>(base(orgSlug), params as Record<string, unknown>),
  metrics: (orgSlug: string) =>
    apiClient.get<ProjectMetrics>(`${base(orgSlug)}/metrics`),
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
  /** CRM contacts (marketflow) matching q, for the project client picker. */
  searchContacts: (orgSlug: string, q: string) =>
    apiClient
      .get<{ data: LookupOption[] }>(`/api/v1/${orgSlug}/lookups/contacts`, { q, limit: 20 })
      .then((r) => r.data ?? []),
  /** The tenant's active treasury cost centres. */
  costCenters: (orgSlug: string) =>
    apiClient.get<{ data: LookupOption[] }>(`/api/v1/${orgSlug}/lookups/cost-centers`).then((r) => r.data ?? []),
};
