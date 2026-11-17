import { apiClient } from './client';
import type { Attachment, PaginatedResponse } from '@/types';
import type { InviteResult, ProjectClient, ThreadComment } from '@/types/portal';

// The team's client portal routes (projects-api docs/api.md, "Client portal", team routes). All
// need the client_portal plan feature; invites and sharing need projects.portal.manage, the
// client thread comments.view or comments.add.

const base = (orgSlug: string, projectId: string) => `/api/v1/${orgSlug}/projects/${projectId}`;

export const clientsApi = {
  list: (orgSlug: string, projectId: string) =>
    apiClient.get<{ data: ProjectClient[] }>(`${base(orgSlug, projectId)}/clients`).then((r) => r.data ?? []),
  /** 201 for a new invite, 200 with resent true when the contact was invited before. */
  invite: (orgSlug: string, projectId: string, crmContactId: string) =>
    apiClient.post<InviteResult>(`${base(orgSlug, projectId)}/clients`, { crm_contact_id: crmContactId }),
  revoke: (orgSlug: string, projectId: string, memberId: string) =>
    apiClient.delete<void>(`${base(orgSlug, projectId)}/clients/${memberId}`),
  shareTask: (orgSlug: string, projectId: string, taskId: string, visible: boolean) =>
    apiClient.patch<{ id: string; client_visible: boolean }>(`${base(orgSlug, projectId)}/tasks/${taskId}/sharing`, { client_visible: visible }),
  shareFile: (orgSlug: string, projectId: string, attachmentId: string, visible: boolean) =>
    apiClient.patch<Attachment>(`${base(orgSlug, projectId)}/attachments/${attachmentId}/sharing`, { client_visible: visible }),
  thread: (orgSlug: string, projectId: string, params?: { limit?: number; page?: number }) =>
    apiClient.get<PaginatedResponse<ThreadComment>>(`${base(orgSlug, projectId)}/client-thread`, params),
  post: (orgSlug: string, projectId: string, content: string, idempotencyKey: string) =>
    apiClient
      .postWithHeaders<ThreadComment>(`${base(orgSlug, projectId)}/client-thread`, { content }, { 'Idempotency-Key': idempotencyKey })
      .then((r) => r.data),
};
