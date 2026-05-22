import { apiClient } from './client';
import type { ProjectMember, PaginatedResponse } from '@/types';

export interface AddMemberInput {
  user_id: string;
  role_code: string;
}

function base(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/members`;
}

export const membersApi = {
  list: (orgSlug: string, projectId: string) =>
    apiClient.get<PaginatedResponse<ProjectMember>>(base(orgSlug, projectId)),
  add: (orgSlug: string, projectId: string, body: AddMemberInput) =>
    apiClient.post<ProjectMember>(base(orgSlug, projectId), body),
  updateRole: (orgSlug: string, projectId: string, userId: string, body: { role_code: string }) =>
    apiClient.put<ProjectMember>(`${base(orgSlug, projectId)}/${userId}`, body),
  remove: (orgSlug: string, projectId: string, userId: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/${userId}`),
};
