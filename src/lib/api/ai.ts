import { apiClient } from './client';
import type { Credits, DraftRisk, DraftTask, Estimate, Health, Review } from '@/lib/ai/drafts';

// AI assistant (sprint 10, projects-api internal/http/handlers/ai.go). Every answer is a draft; the
// person saves what they accept through the ordinary task and risk routes. Each call spends the
// organisation's prepaid AI credits; the Idempotency-Key makes a retry of the same ask free.

/** AI answers can take longer than the 15 second default. */
const AI_TIMEOUT_MS = 30_000;

export interface TaskBreakdown extends Review {
  draft: true;
  project_id: string;
  parent_task_id: string | null;
  tasks: DraftTask[];
  credits: Credits;
}

export interface StatusSummary extends Review {
  draft: true;
  project_id: string;
  period_from: string;
  period_to: string;
  health: Health;
  summary: string;
  accomplishments: string[];
  next_steps: string[];
  issues: string[];
  includes_financials: boolean;
  credits: Credits;
}

export interface RiskSuggestions extends Review {
  draft: true;
  project_id: string;
  risks: DraftRisk[];
  credits: Credits;
}

export interface Estimates extends Review {
  draft: true;
  project_id: string;
  estimates: Estimate[];
  credits: Credits;
}

export interface SearchResult {
  kind: 'project' | 'tender';
  id: string;
  title: string;
  status: string;
  reason: string;
  rank: number;
}

export interface SearchResults extends Review {
  query: string;
  results: SearchResult[];
  credits?: Credits;
}

export interface FeatureTotal {
  feature: string;
  calls: number;
  completed: number;
  credits: number;
  total_tokens: number;
}

export interface UsageEntry {
  id: string;
  user_id: string | null;
  project_id: string | null;
  feature: string;
  status: 'completed' | 'refused' | 'failed';
  reason?: string;
  credits_charged: number;
  exempt: boolean;
  total_tokens: number;
  created_at: string;
}

export interface UsageReport {
  since: string;
  totals: FeatureTotal[];
  items: UsageEntry[];
  total: number;
  limit: number;
  offset: number;
}

const p = (orgSlug: string, projectId: string) => `/api/v1/${orgSlug}/projects/${projectId}/ai`;

function ask<T>(url: string, body: unknown, key: string): Promise<T> {
  return apiClient.postWithHeaders<T>(url, body, { 'Idempotency-Key': key }, AI_TIMEOUT_MS).then((r) => r.data);
}

export const aiApi = {
  taskBreakdown: (orgSlug: string, projectId: string, body: { brief: string; parent_task_id?: string }, key: string) =>
    ask<TaskBreakdown>(`${p(orgSlug, projectId)}/task-breakdown`, body, key),
  statusSummary: (orgSlug: string, projectId: string, body: { period_days?: number }, key: string) =>
    ask<StatusSummary>(`${p(orgSlug, projectId)}/status-summary`, body, key),
  riskSuggestions: (orgSlug: string, projectId: string, key: string) =>
    ask<RiskSuggestions>(`${p(orgSlug, projectId)}/risk-suggestions`, {}, key),
  estimates: (orgSlug: string, projectId: string, taskIds: string[], key: string) =>
    ask<Estimates>(`${p(orgSlug, projectId)}/estimates`, { task_ids: taskIds }, key),
  search: (orgSlug: string, query: string, key: string) => ask<SearchResults>(`/api/v1/${orgSlug}/ai/search`, { query }, key),
  usage: (orgSlug: string, params: { days?: number; limit?: number; offset?: number }) =>
    apiClient.get<UsageReport>(`/api/v1/${orgSlug}/ai/usage`, params as Record<string, unknown>),
};
