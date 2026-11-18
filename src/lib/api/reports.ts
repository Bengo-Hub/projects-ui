import { apiClient } from './client';
import type { PaginatedResponse } from '@/types';
import type { DigestSettings, ReportCreateInput, ReportListParams, ReportUpdateInput, StatusReport } from '@/types/reports';

// Status reports and the weekly digest switch (sprint 7, projects-api
// internal/http/handlers/statusreports.go). Every route needs project_management.

const p = (orgSlug: string, projectId: string) => `/api/v1/${orgSlug}/projects/${projectId}/status-reports`;

export const reportsApi = {
  /** Newest period first. */
  list: (orgSlug: string, projectId: string, params: ReportListParams) =>
    apiClient.get<PaginatedResponse<StatusReport>>(p(orgSlug, projectId), params as Record<string, unknown>),
  get: (orgSlug: string, projectId: string, id: string) => apiClient.get<StatusReport>(`${p(orgSlug, projectId)}/${id}`),
  /** 201 with the filled draft; 409 report_exists for a period already reported. */
  create: (orgSlug: string, projectId: string, body: ReportCreateInput) => apiClient.post<StatusReport>(p(orgSlug, projectId), body),
  update: (orgSlug: string, projectId: string, id: string, body: ReportUpdateInput) =>
    apiClient.put<StatusReport>(`${p(orgSlug, projectId)}/${id}`, body),
  refresh: (orgSlug: string, projectId: string, id: string) => apiClient.post<StatusReport>(`${p(orgSlug, projectId)}/${id}/refresh`),
  publish: (orgSlug: string, projectId: string, id: string) => apiClient.post<StatusReport>(`${p(orgSlug, projectId)}/${id}/publish`),
  delete: (orgSlug: string, projectId: string, id: string) => apiClient.delete<void>(`${p(orgSlug, projectId)}/${id}`),
  share: (orgSlug: string, projectId: string, id: string, includeFinancials: boolean) =>
    apiClient.post<StatusReport>(`${p(orgSlug, projectId)}/${id}/share`, { include_financials: includeFinancials }),
  unshare: (orgSlug: string, projectId: string, id: string) => apiClient.post<StatusReport>(`${p(orgSlug, projectId)}/${id}/unshare`),
  /** The inline PDF (a draft says so in its subtitle). */
  pdf: (orgSlug: string, projectId: string, id: string) => apiClient.getBlob(`${p(orgSlug, projectId)}/${id}/pdf`),
};

export const digestApi = {
  get: (orgSlug: string) => apiClient.get<DigestSettings>(`/api/v1/${orgSlug}/settings/digest`),
  /** reports.manage and the admin tier; anyone else gets 403 admin_required. */
  save: (orgSlug: string, body: DigestSettings) => apiClient.put<DigestSettings>(`/api/v1/${orgSlug}/settings/digest`, body),
};
