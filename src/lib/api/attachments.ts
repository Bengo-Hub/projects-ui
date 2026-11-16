import { apiClient } from './client';
import type { Attachment, PaginatedResponse, UploadTicket } from '@/types';

export interface UploadRequest {
  file_name: string;
  content_type: string;
  size: number;
  task_id?: string;
}

function base(orgSlug: string, projectId: string) {
  return `/api/v1/${orgSlug}/projects/${projectId}/attachments`;
}

export const attachmentsApi = {
  listProject: (orgSlug: string, projectId: string, params?: { limit?: number; page?: number }) =>
    apiClient.get<PaginatedResponse<Attachment>>(base(orgSlug, projectId), params),
  listTask: (orgSlug: string, projectId: string, taskId: string, params?: { limit?: number; page?: number }) =>
    apiClient.get<PaginatedResponse<Attachment>>(`/api/v1/${orgSlug}/projects/${projectId}/tasks/${taskId}/attachments`, params),
  /** Step one: a presigned PUT straight to object storage. */
  requestUpload: (orgSlug: string, projectId: string, body: UploadRequest) =>
    apiClient.post<UploadTicket>(`${base(orgSlug, projectId)}/uploads`, body),
  /** Step three, after the PUT: the API checks the stored bytes and lists the file. */
  confirm: (orgSlug: string, projectId: string, body: { key: string; file_name: string; task_id?: string }) =>
    apiClient.post<Attachment>(base(orgSlug, projectId), body),
  delete: (orgSlug: string, projectId: string, id: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/${id}`),
};

/**
 * Step two: PUT the file to the presigned link with exactly the headers it was signed with. This
 * goes straight to storage, so it never carries the API's Authorization header.
 */
export async function putToStorage(ticket: UploadTicket, file: Blob, signal?: AbortSignal): Promise<void> {
  const res = await fetch(ticket.upload.url, {
    method: ticket.upload.method || 'PUT',
    headers: ticket.upload.headers,
    body: file,
    signal,
  });
  if (!res.ok) throw Object.assign(new Error(`upload failed (${res.status})`), { status: res.status });
}
