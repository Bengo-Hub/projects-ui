import { apiClient } from './client';
import type {
  QACriterion,
  QACriterionInput,
  QADefect,
  QAFeatureCatalog,
  QAInvite,
  QAList,
  QAOutcome,
  QAPage,
  QAPassRule,
  QARecordOutcome,
  QAResult,
  QARole,
  QASession,
  QASessionSubject,
  QATemplate,
  QATemplateKind,
  QATemplateStatus,
  QAVerdictInput,
} from '@/types/qa';

// Tenant routes of the QA and acceptance module (projects-api docs/api.md, "Tenant routes").

export interface CreateTemplateInput {
  name: string;
  kind?: QATemplateKind;
  service_tag?: string;
  status?: QATemplateStatus;
  pass_rule?: QAPassRule;
  metadata?: Record<string, unknown>;
  /** A platform template (no tenant); the platform owner only. */
  platform?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  service_tag?: string;
  status?: QATemplateStatus;
  pass_rule?: QAPassRule;
  metadata?: Record<string, unknown>;
  clear_review?: boolean;
}

export interface CreateSessionInput {
  template_id: string;
  title: string;
  subject_kind: QASessionSubject;
  subject_ref?: string;
  pass_rule?: QAPassRule;
  tenant_name?: string;
}

export interface InviteInput {
  email: string;
  name?: string;
  role: QARole;
}

export interface ListParams {
  status?: string;
  service_tag?: string;
  page?: number;
  limit?: number;
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}/qa`;
}

const enc = encodeURIComponent;

export const qaApi = {
  catalogFeatures: (orgSlug: string, service?: string) =>
    apiClient.get<QAFeatureCatalog>(`${base(orgSlug)}/catalog/features`, service ? { service } : undefined),

  listTemplates: (orgSlug: string, params?: ListParams) =>
    apiClient.get<QAPage<QATemplate>>(`${base(orgSlug)}/templates`, params as Record<string, unknown>),
  getTemplate: (orgSlug: string, id: string) =>
    apiClient.get<QATemplate>(`${base(orgSlug)}/templates/${enc(id)}`),
  createTemplate: (orgSlug: string, body: CreateTemplateInput) =>
    apiClient.post<QATemplate>(`${base(orgSlug)}/templates`, body),
  updateTemplate: (orgSlug: string, id: string, body: UpdateTemplateInput) =>
    apiClient.patch<QATemplate>(`${base(orgSlug)}/templates/${enc(id)}`, body),
  addCriteria: (orgSlug: string, templateId: string, criteria: QACriterionInput[]) =>
    apiClient.post<QAList<QACriterion>>(`${base(orgSlug)}/templates/${enc(templateId)}/criteria`, { criteria }),
  updateCriterion: (orgSlug: string, templateId: string, criterionId: string, body: QACriterionInput) =>
    apiClient.put<QACriterion>(`${base(orgSlug)}/templates/${enc(templateId)}/criteria/${enc(criterionId)}`, body),
  deleteCriterion: (orgSlug: string, templateId: string, criterionId: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/templates/${enc(templateId)}/criteria/${enc(criterionId)}`),

  listSessions: (orgSlug: string, params?: ListParams) =>
    apiClient.get<QAPage<QASession>>(`${base(orgSlug)}/sessions`, params as Record<string, unknown>),
  getSession: (orgSlug: string, id: string) =>
    apiClient.get<QASession>(`${base(orgSlug)}/sessions/${enc(id)}`),
  createSession: (orgSlug: string, body: CreateSessionInput) =>
    apiClient.post<QASession>(`${base(orgSlug)}/sessions`, body),
  outcome: (orgSlug: string, id: string) =>
    apiClient.get<QAOutcome>(`${base(orgSlug)}/sessions/${enc(id)}/outcome`),
  openSession: (orgSlug: string, id: string) =>
    apiClient.post<QASession>(`${base(orgSlug)}/sessions/${enc(id)}/open`),
  closeSession: (orgSlug: string, id: string) =>
    apiClient.post<QASession>(`${base(orgSlug)}/sessions/${enc(id)}/close`),
  decide: (orgSlug: string, id: string, decision: 'accepted' | 'rejected', reason: string) =>
    apiClient.post<QASession>(`${base(orgSlug)}/sessions/${enc(id)}/decision`, { decision, reason }),

  listInvites: (orgSlug: string, id: string) =>
    apiClient.get<QAList<QAInvite>>(`${base(orgSlug)}/sessions/${enc(id)}/invites`),
  invite: (orgSlug: string, id: string, invites: InviteInput[]) =>
    apiClient.post<QAList<QAInvite>>(`${base(orgSlug)}/sessions/${enc(id)}/invites`, { invites }),
  revokeInvite: (orgSlug: string, id: string, inviteId: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/sessions/${enc(id)}/invites/${enc(inviteId)}`),

  listResults: (orgSlug: string, id: string, history = false) =>
    apiClient.get<QAList<QAResult>>(`${base(orgSlug)}/sessions/${enc(id)}/results`, history ? { history: true } : undefined),
  recordResult: (orgSlug: string, id: string, criterionId: string, body: QAVerdictInput) =>
    apiClient.post<QARecordOutcome>(`${base(orgSlug)}/sessions/${enc(id)}/results`, { ...body, criterion_id: criterionId }),

  listDefects: (orgSlug: string, id: string) =>
    apiClient.get<QAList<QADefect>>(`${base(orgSlug)}/sessions/${enc(id)}/defects`),
  raiseDefect: (orgSlug: string, id: string, criterionId: string) =>
    apiClient.post<QADefect>(`${base(orgSlug)}/sessions/${enc(id)}/defects`, { criterion_id: criterionId }),

  reportPdf: (orgSlug: string, id: string) =>
    apiClient.getBlob(`${base(orgSlug)}/sessions/${enc(id)}/report.pdf`),
};

/** The API's own error text ({"error": "..."}), or the fallback. */
export function qaErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    return (data as { error: string }).error;
  }
  return fallback;
}
