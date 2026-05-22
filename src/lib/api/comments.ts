import { apiClient } from './client';
import type { Comment, PaginatedResponse } from '@/types';

export interface CreateCommentInput {
  content: string;
}

function projectBase(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/comments`;
}
function taskBase(orgSlug: string, projectId: string, taskId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/tasks/${taskId}/comments`;
}

export const commentsApi = {
  listProject: (orgSlug: string, projectId: string) =>
    apiClient.get<PaginatedResponse<Comment>>(projectBase(orgSlug, projectId)),
  listTask: (orgSlug: string, projectId: string, taskId: string) =>
    apiClient.get<PaginatedResponse<Comment>>(taskBase(orgSlug, projectId, taskId)),
  createOnProject: (orgSlug: string, projectId: string, body: CreateCommentInput) =>
    apiClient.post<Comment>(projectBase(orgSlug, projectId), body),
  createOnTask: (orgSlug: string, projectId: string, taskId: string, body: CreateCommentInput) =>
    apiClient.post<Comment>(taskBase(orgSlug, projectId, taskId), body),
  update: (orgSlug: string, projectId: string, id: string, body: CreateCommentInput) =>
    apiClient.put<Comment>(`/api/v1/${orgSlug}/projects/${projectId}/comments/${id}`, body),
  delete: (orgSlug: string, projectId: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/projects/${projectId}/comments/${id}`),
};
