import { apiClient } from './client';
import type { Milestone, PaginatedResponse } from '@/types';

export interface CreateMilestoneInput {
  name: string;
  description?: string;
  target_date?: string;
  status?: string;
}

function base(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/milestones`;
}

export const milestonesApi = {
  list: (orgSlug: string, projectId: string) =>
    apiClient.get<PaginatedResponse<Milestone>>(base(orgSlug, projectId)),
  get: (orgSlug: string, projectId: string, id: string) =>
    apiClient.get<Milestone>(`${base(orgSlug, projectId)}/${id}`),
  create: (orgSlug: string, projectId: string, body: CreateMilestoneInput) =>
    apiClient.post<Milestone>(base(orgSlug, projectId), body),
  update: (orgSlug: string, projectId: string, id: string, body: Partial<CreateMilestoneInput>) =>
    apiClient.put<Milestone>(`${base(orgSlug, projectId)}/${id}`, body),
  delete: (orgSlug: string, projectId: string, id: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/${id}`),
};
