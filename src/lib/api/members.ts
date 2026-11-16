import { apiClient } from './client';
import type { ProjectMember, PaginatedResponse } from '@/types';

export interface AddMemberInput {
  user_id: string;
  role_code: string;
}

/** Search (name or email) and paging for the member list; the API caps limit at 500. */
export interface ListMembersParams {
  q?: string;
  limit?: number;
  page?: number;
}

/** A project's whole team fits in one page: the API caps a project at this many listed members. */
export const MEMBERS_PAGE_LIMIT = 500;

/** Add and role change answer the membership row alone, without the name and email. */
type MembershipRow = Omit<ProjectMember, 'name' | 'email'>;

function base(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/members`;
}

export const membersApi = {
  /** Members with their name and email, longest standing first. */
  list: (orgSlug: string, projectId: string, params: ListMembersParams = {}) =>
    apiClient.get<PaginatedResponse<ProjectMember>>(base(orgSlug, projectId), {
      limit: MEMBERS_PAGE_LIMIT,
      ...params,
    } as Record<string, unknown>),
  add: (orgSlug: string, projectId: string, body: AddMemberInput) =>
    apiClient.post<MembershipRow>(base(orgSlug, projectId), body),
  updateRole: (orgSlug: string, projectId: string, userId: string, body: { role_code: string }) =>
    apiClient.put<MembershipRow>(`${base(orgSlug, projectId)}/${userId}`, body),
  remove: (orgSlug: string, projectId: string, userId: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/${userId}`),
};
