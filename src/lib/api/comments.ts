import { apiClient } from './client';
import type { Comment, PaginatedResponse } from '@/types';

export interface CreateCommentInput {
  content: string;
}

/** One page of comments: limit (up to 500) with a 1-based page. */
export interface ListCommentsParams {
  limit?: number;
  page?: number;
}

function projectBase(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/comments`;
}
function taskBase(orgSlug: string, projectId: string, taskId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/tasks/${taskId}/comments`;
}

export const commentsApi = {
  listProject: (orgSlug: string, projectId: string, params?: ListCommentsParams) =>
    apiClient.get<PaginatedResponse<Comment>>(projectBase(orgSlug, projectId), params as Record<string, unknown>),
  /** Oldest first. GET task already carries the latest 50, so this is for older pages. */
  listTask: (orgSlug: string, projectId: string, taskId: string, params?: ListCommentsParams) =>
    apiClient.get<PaginatedResponse<Comment>>(taskBase(orgSlug, projectId, taskId), params as Record<string, unknown>),
  createOnProject: (orgSlug: string, projectId: string, body: CreateCommentInput) =>
    apiClient.post<Comment>(projectBase(orgSlug, projectId), body),
  /**
   * Posts a task comment. The Idempotency-Key (one per comment the person writes, kept across
   * retries and the offline queue) makes a replay answer the comment already posted; replayed is
   * true for such a duplicate.
   */
  createOnTask: (orgSlug: string, projectId: string, taskId: string, body: CreateCommentInput, idempotencyKey: string) =>
    apiClient
      .postWithHeaders<Comment>(taskBase(orgSlug, projectId, taskId), body, { 'Idempotency-Key': idempotencyKey })
      .then((r) => ({ comment: r.data, replayed: r.headers['idempotent-replayed'] === 'true' })),
  update: (orgSlug: string, projectId: string, id: string, body: CreateCommentInput) =>
    apiClient.put<Comment>(`/api/v1/${orgSlug}/projects/${projectId}/comments/${id}`, body),
  delete: (orgSlug: string, projectId: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/projects/${projectId}/comments/${id}`),
};
