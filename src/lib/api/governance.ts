import { apiClient } from './client';
import type { PaginatedResponse } from '@/types';
import type {
  Decision,
  DecisionInput,
  DecisionListParams,
  GovernanceRole,
  GovernanceRoleInput,
  RaciEntry,
  RaciInput,
} from '@/types/governance';

// Governance (sprint 7, US-7.1, projects-api internal/http/handlers/governance.go): seats, the
// RACI matrix and the decision log. Every route needs project_management.

const p = (orgSlug: string, projectId: string) => `/api/v1/${orgSlug}/projects/${projectId}`;

export const governanceApi = {
  roles: (orgSlug: string, projectId: string) =>
    apiClient.get<{ data: GovernanceRole[] }>(`${p(orgSlug, projectId)}/governance/roles`).then((r) => r.data ?? []),
  createRole: (orgSlug: string, projectId: string, body: GovernanceRoleInput) =>
    apiClient.post<GovernanceRole>(`${p(orgSlug, projectId)}/governance/roles`, body),
  updateRole: (orgSlug: string, projectId: string, id: string, body: GovernanceRoleInput) =>
    apiClient.put<GovernanceRole>(`${p(orgSlug, projectId)}/governance/roles/${id}`, body),
  deleteRole: (orgSlug: string, projectId: string, id: string) => apiClient.delete<void>(`${p(orgSlug, projectId)}/governance/roles/${id}`),

  raci: (orgSlug: string, projectId: string) =>
    apiClient.get<{ data: RaciEntry[] }>(`${p(orgSlug, projectId)}/raci`).then((r) => r.data ?? []),
  createRaci: (orgSlug: string, projectId: string, body: RaciInput) => apiClient.post<RaciEntry>(`${p(orgSlug, projectId)}/raci`, body),
  updateRaci: (orgSlug: string, projectId: string, id: string, body: RaciInput) =>
    apiClient.put<RaciEntry>(`${p(orgSlug, projectId)}/raci/${id}`, body),
  deleteRaci: (orgSlug: string, projectId: string, id: string) => apiClient.delete<void>(`${p(orgSlug, projectId)}/raci/${id}`),

  /** Newest number first. */
  decisions: (orgSlug: string, projectId: string, params: DecisionListParams) =>
    apiClient.get<PaginatedResponse<Decision>>(`${p(orgSlug, projectId)}/decisions`, params as Record<string, unknown>),
  logDecision: (orgSlug: string, projectId: string, body: DecisionInput) => apiClient.post<Decision>(`${p(orgSlug, projectId)}/decisions`, body),
  updateDecision: (orgSlug: string, projectId: string, id: string, body: DecisionInput) =>
    apiClient.put<Decision>(`${p(orgSlug, projectId)}/decisions/${id}`, body),
  deleteDecision: (orgSlug: string, projectId: string, id: string) => apiClient.delete<void>(`${p(orgSlug, projectId)}/decisions/${id}`),
  decide: (orgSlug: string, projectId: string, id: string, body: { decision: 'approve' | 'reject'; comment: string }) =>
    apiClient.post<Decision>(`${p(orgSlug, projectId)}/decisions/${id}/decide`, body),
  supersede: (orgSlug: string, projectId: string, id: string, supersededBy?: string) =>
    apiClient.post<Decision>(`${p(orgSlug, projectId)}/decisions/${id}/supersede`, supersededBy ? { superseded_by: supersededBy } : {}),
};
