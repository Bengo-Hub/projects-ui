import { apiClient } from './client';
import type {
  BidBudgetLine,
  ListResponse,
  PaginatedResponse,
  Tender,
  TenderBudgetState,
  TenderCommittee,
  TenderConvertResult,
  TenderCriterion,
  TenderDocument,
  TenderEvaluation,
  TenderEvaluationSummary,
  TenderMeeting,
  TenderMetrics,
  TenderSection,
  TenderSectionSummary,
  TenderSubmission,
  UploadTicket,
} from '@/types';

export interface CreateTenderInput {
  title: string;
  client_name: string;
  source?: string;
  priority?: string;
  estimated_value?: number;
  currency?: string;
  /** YYYY-MM-DD */
  deadline?: string;
  description?: string;
  submission_type?: string;
  /** Partial on an update: a key set to null is removed. */
  metadata?: {
    crm_contact_id?: string | null;
    crm_contact_name?: string | null;
    tags?: string[] | null;
    bid_budget?: { lines: BidBudgetLine[] } | null;
  };
}

export interface CreateEvaluationInput {
  score: number;
  notes?: string;
  criteria?: string;
}

export interface CreateMeetingInput {
  title: string;
  scheduled_at: string;
  platform?: string;
  meeting_url?: string;
  notes?: string;
}

export interface ListTendersParams {
  status?: string;
  priority?: string;
  q?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface DecisionInput {
  criteria: TenderCriterion[];
  threshold?: number;
  decision: 'go' | 'no_go';
  comment: string;
}

export interface OutcomeInput {
  outcome: 'won' | 'lost';
  award_date?: string;
  award_value?: number;
  contract_reference?: string;
  contract_start?: string;
  contract_end?: string;
  loss_reason?: string;
  competitor?: string;
  competitor_price?: number;
  lessons?: string;
}

export interface ConvertInput {
  name?: string;
  billing_type?: string;
  contract_value?: number;
  start_date?: string;
  end_date?: string;
  owner_id?: string;
  template_id?: string;
  crm_contact_id?: string;
  crm_contact_name?: string;
  skip_team?: boolean;
  skip_budget?: boolean;
}

export interface SectionInput {
  title?: string;
  description?: string;
  position?: number;
  /** "" clears it. */
  assignee_id?: string;
  reviewer_id?: string;
  due_date?: string;
  document_id?: string;
  status?: 'not_started' | 'in_progress';
}

export interface SubmissionInput {
  method: 'online' | 'email' | 'physical';
  submitted_at?: string;
  recipient?: string;
  reference?: string;
  courier?: string;
  notes?: string;
  document_id?: string;
  proof_document_id?: string;
  email_subject?: string;
  override_sections?: boolean;
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}/tenders`;
}

export const tendersApi = {
  list: (orgSlug: string, params?: ListTendersParams) =>
    apiClient.get<PaginatedResponse<Tender>>(base(orgSlug), params as Record<string, unknown>),
  get: (orgSlug: string, id: string) =>
    apiClient.get<Tender>(`${base(orgSlug)}/${id}`),
  create: (orgSlug: string, body: CreateTenderInput) =>
    apiClient.post<Tender>(base(orgSlug), body),
  update: (orgSlug: string, id: string, body: Partial<CreateTenderInput>) =>
    apiClient.put<Tender>(`${base(orgSlug)}/${id}`, body),
  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/${id}`),
  metrics: (orgSlug: string) =>
    apiClient.get<TenderMetrics>(`${base(orgSlug)}/metrics`),

  changeStatus: (orgSlug: string, id: string, body: { status: string; note?: string }) =>
    apiClient.post<Tender>(`${base(orgSlug)}/${id}/status`, body),
  evaluationSummary: (orgSlug: string, id: string) =>
    apiClient.get<TenderEvaluationSummary>(`${base(orgSlug)}/${id}/evaluation-summary`),
  decide: (orgSlug: string, id: string, body: DecisionInput) =>
    apiClient.post<Tender>(`${base(orgSlug)}/${id}/decision`, body),
  recordOutcome: (orgSlug: string, id: string, body: OutcomeInput) =>
    apiClient.post<Tender>(`${base(orgSlug)}/${id}/outcome`, body),
  convert: (orgSlug: string, id: string, body: ConvertInput) =>
    apiClient.post<TenderConvertResult>(`${base(orgSlug)}/${id}/convert`, body),
  pushConversionBudget: (orgSlug: string, id: string) =>
    apiClient.post<{ budget: TenderBudgetState }>(`${base(orgSlug)}/${id}/conversion/push-budget`),

  listSections: (orgSlug: string, id: string) =>
    apiClient.get<{ data: TenderSection[]; summary: TenderSectionSummary }>(`${base(orgSlug)}/${id}/sections`),
  createSection: (orgSlug: string, id: string, body: SectionInput) =>
    apiClient.post<TenderSection>(`${base(orgSlug)}/${id}/sections`, body),
  updateSection: (orgSlug: string, id: string, sectionId: string, body: SectionInput) =>
    apiClient.put<TenderSection>(`${base(orgSlug)}/${id}/sections/${sectionId}`, body),
  deleteSection: (orgSlug: string, id: string, sectionId: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/${id}/sections/${sectionId}`),
  submitSection: (orgSlug: string, id: string, sectionId: string) =>
    apiClient.post<TenderSection>(`${base(orgSlug)}/${id}/sections/${sectionId}/submit`),
  approveSection: (orgSlug: string, id: string, sectionId: string, comment?: string) =>
    apiClient.post<TenderSection>(`${base(orgSlug)}/${id}/sections/${sectionId}/approve`, { comment: comment ?? '' }),
  requestSectionChanges: (orgSlug: string, id: string, sectionId: string, comment: string) =>
    apiClient.post<TenderSection>(`${base(orgSlug)}/${id}/sections/${sectionId}/request-changes`, { comment }),

  listSubmissions: (orgSlug: string, id: string) =>
    apiClient.get<ListResponse<TenderSubmission>>(`${base(orgSlug)}/${id}/submissions`),
  submit: (orgSlug: string, id: string, body: SubmissionInput) =>
    apiClient.post<TenderSubmission>(`${base(orgSlug)}/${id}/submissions`, body),

  listDocuments: (orgSlug: string, id: string) =>
    apiClient.get<ListResponse<TenderDocument>>(`${base(orgSlug)}/${id}/documents`),
  /** Step one of an upload: a presigned PUT straight to object storage. */
  requestUpload: (orgSlug: string, id: string, body: { file_name: string; content_type: string; size: number }) =>
    apiClient.post<UploadTicket>(`${base(orgSlug)}/${id}/documents/uploads`, body),
  /** Step three (key) after the PUT, or a link to a file kept elsewhere (file_url, https). */
  addDocument: (orgSlug: string, id: string, body: { key?: string; file_url?: string; file_name: string }) =>
    apiClient.post<TenderDocument>(`${base(orgSlug)}/${id}/documents`, body),
  deleteDocument: (orgSlug: string, id: string, docId: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/${id}/documents/${docId}`),

  listCommittees: (orgSlug: string, tenderId: string) =>
    apiClient.get<ListResponse<TenderCommittee>>(`${base(orgSlug)}/${tenderId}/committees`),
  createCommittee: (orgSlug: string, tenderId: string, body: { name: string }) =>
    apiClient.post<TenderCommittee>(`${base(orgSlug)}/${tenderId}/committees`, body),
  addCommitteeMember: (orgSlug: string, tenderId: string, committeeId: string, body: { user_id: string; role?: string }) =>
    apiClient.post<void>(`${base(orgSlug)}/${tenderId}/committees/${committeeId}/members`, body),
  removeCommitteeMember: (orgSlug: string, tenderId: string, committeeId: string, userId: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/${tenderId}/committees/${committeeId}/members/${userId}`),

  listEvaluations: (orgSlug: string, tenderId: string) =>
    apiClient.get<ListResponse<TenderEvaluation>>(`${base(orgSlug)}/${tenderId}/evaluations`),
  submitEvaluation: (orgSlug: string, tenderId: string, body: CreateEvaluationInput) =>
    apiClient.post<TenderEvaluation>(`${base(orgSlug)}/${tenderId}/evaluations`, body),

  listMeetings: (orgSlug: string, tenderId: string) =>
    apiClient.get<ListResponse<TenderMeeting>>(`${base(orgSlug)}/${tenderId}/meetings`),
  scheduleMeeting: (orgSlug: string, tenderId: string, body: CreateMeetingInput) =>
    apiClient.post<TenderMeeting>(`${base(orgSlug)}/${tenderId}/meetings`, body),
};
