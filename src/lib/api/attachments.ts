import { apiClient } from './client';
import type { Attachment, PaginatedResponse } from '@/types';

/** Attachments are links to files kept elsewhere (drive, storage bucket): the API stores the link. */
export interface CreateAttachmentInput {
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
}

function projectBase(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/attachments`;
}
function taskBase(orgSlug: string, projectId: string, taskId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/tasks/${taskId}/attachments`;
}

export const attachmentsApi = {
  listProject: (orgSlug: string, projectId: string) =>
    apiClient.get<PaginatedResponse<Attachment>>(projectBase(orgSlug, projectId)),
  listTask: (orgSlug: string, projectId: string, taskId: string) =>
    apiClient.get<PaginatedResponse<Attachment>>(taskBase(orgSlug, projectId, taskId)),
  createOnProject: (orgSlug: string, projectId: string, body: CreateAttachmentInput) =>
    apiClient.post<Attachment>(projectBase(orgSlug, projectId), body),
  createOnTask: (orgSlug: string, projectId: string, taskId: string, body: CreateAttachmentInput) =>
    apiClient.post<Attachment>(taskBase(orgSlug, projectId, taskId), body),
  delete: (orgSlug: string, projectId: string, id: string) =>
    apiClient.delete<void>(`${projectBase(orgSlug, projectId)}/${id}`),
};
