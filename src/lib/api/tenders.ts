import { apiClient } from './client';
import type {
  Tender,
  TenderCommittee,
  TenderEvaluation,
  TenderMeeting,
  TenderMetrics,
  PaginatedResponse,
} from '@/types';

export interface CreateTenderInput {
  title: string;
  client_name: string;
  source?: string;
  priority?: string;
  estimated_value?: number;
  currency?: string;
  deadline?: string;
  description?: string;
  submission_type?: string;
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
  page?: number;
  page_size?: number;
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

  listCommittees: (orgSlug: string, tenderId: string) =>
    apiClient.get<PaginatedResponse<TenderCommittee>>(`${base(orgSlug)}/${tenderId}/committees`),
  createCommittee: (orgSlug: string, tenderId: string, body: { name: string }) =>
    apiClient.post<TenderCommittee>(`${base(orgSlug)}/${tenderId}/committees`, body),
  addCommitteeMember: (orgSlug: string, tenderId: string, committeeId: string, body: { user_id: string; role?: string }) =>
    apiClient.post<void>(`${base(orgSlug)}/${tenderId}/committees/${committeeId}/members`, body),
  removeCommitteeMember: (orgSlug: string, tenderId: string, committeeId: string, userId: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/${tenderId}/committees/${committeeId}/members/${userId}`),

  listEvaluations: (orgSlug: string, tenderId: string) =>
    apiClient.get<PaginatedResponse<TenderEvaluation>>(`${base(orgSlug)}/${tenderId}/evaluations`),
  submitEvaluation: (orgSlug: string, tenderId: string, body: CreateEvaluationInput) =>
    apiClient.post<TenderEvaluation>(`${base(orgSlug)}/${tenderId}/evaluations`, body),

  listMeetings: (orgSlug: string, tenderId: string) =>
    apiClient.get<PaginatedResponse<TenderMeeting>>(`${base(orgSlug)}/${tenderId}/meetings`),
  scheduleMeeting: (orgSlug: string, tenderId: string, body: CreateMeetingInput) =>
    apiClient.post<TenderMeeting>(`${base(orgSlug)}/${tenderId}/meetings`, body),
};
