import { apiClient } from './client';
import type { PaginatedResponse, Project } from '@/types';
import type { AutomationRule, StatusRules } from '@/lib/planning/rules';

// Planning depth (sprint 16, projects-api internal/http/handlers/planning.go): workload, baselines
// and slips, the risk register, change requests, project templates, status rules and automations.
// Recurring tasks ride on the normal task create and update (metadata.repeat).

// Workload (workload_planning).

export interface WeekLoad {
  week_start: string;
  demand_hours: number;
  capacity_hours: number;
  load_pct: number;
  overloaded: boolean;
  task_count: number;
}

export interface PersonLoad {
  user_id: string;
  name: string;
  email: string;
  weekly_capacity: number;
  total_demand: number;
  overloaded_weeks: number;
  weeks: WeekLoad[];
}

export interface UnassignedWeek {
  week_start: string;
  demand_hours: number;
  task_count: number;
}

export interface Workload {
  from: string;
  to: string;
  weeks: string[];
  default_weekly_hours: number;
  capacity_source: string;
  people: PersonLoad[];
  unassigned: UnassignedWeek[];
  truncated: boolean;
}

export interface WorkloadParams {
  from?: string;
  weeks?: number;
  project_id?: string;
  include_done?: boolean;
}

/** One task behind a workload cell, largest share first. */
export interface WorkloadTask {
  task_id: string;
  title: string;
  project_id: string;
  project_name: string;
  status: string;
  due_date: string;
  hours: number;
}

export interface WorkloadSettings {
  weekly_hours: number;
  person_hours: Record<string, number>;
  capacity_source?: string;
}

// Baselines (task_tracking + gantt_chart).

export interface BaselineSummary {
  id: string;
  project_id: string;
  name: string;
  note: string;
  task_count: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface BaselineTask {
  id: string;
  title: string;
  status: string;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  parent_id?: string;
}

/** The baseline on the Gantt answer: tasks keyed by id. */
export interface GanttBaseline {
  id: string;
  name: string;
  created_at: string;
  tasks: Record<string, BaselineTask>;
  milestones: { id: string; name: string; target_date?: string }[];
  truncated: boolean;
}

export interface Slip {
  kind: 'task' | 'milestone';
  id: string;
  title: string;
  status?: string;
  baseline_start?: string | null;
  current_start?: string | null;
  baseline_finish: string | null;
  current_finish: string | null;
  start_slip_days: number;
  finish_slip_days: number;
  estimate_change_hours: number;
}

export interface SlipsReport {
  baseline: BaselineSummary;
  slips: Slip[];
  tasks_compared: number;
  slipped: number;
  pulled_in: number;
  max_slip_days: number;
  removed_since: number;
  added_since: number;
  milestones_slipped: number;
}

// Risks.

export type RiskStatus = 'open' | 'monitoring' | 'mitigated' | 'occurred' | 'closed';

export interface Risk {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  category?: string;
  likelihood: number;
  impact: number;
  score: number;
  owner_id?: string;
  owner_name: string;
  mitigation?: string;
  status: RiskStatus;
  due_date?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Create or patch: on an update owner_id "" or due_date "" clears it. */
export interface RiskInput {
  title?: string;
  description?: string;
  category?: string;
  likelihood?: number;
  impact?: number;
  owner_id?: string;
  mitigation?: string;
  status?: RiskStatus;
  due_date?: string;
}

export interface RiskListParams {
  page?: number;
  limit?: number;
  status?: string;
  min_score?: number;
  owner_id?: string;
}

export interface RiskHeatMap {
  /** grid[likelihood-1][impact-1]. */
  grid: number[][];
  cells: { likelihood: number; impact: number; count: number }[];
  total: number;
}

// Change requests.

export type ChangeKind = 'scope' | 'cost' | 'schedule';
export type ChangeStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type TreasuryPushStatus = 'not_needed' | 'pending' | 'pushing' | 'submitted' | 'failed';

export interface DateShift {
  task_id: string;
  shift_days?: number;
  start_date?: string;
  due_date?: string;
}

export interface BudgetLineInput {
  category: 'expense' | 'capex' | 'revenue' | 'other';
  name: string;
  planned_amount: string;
  notes?: string;
}

/** A treasury BudgetInput body; projects-api forces budget_type and project_id. */
export interface BudgetBody {
  name: string;
  fiscal_year: string;
  period_type: 'monthly' | 'quarterly' | 'annual';
  start_date: string;
  end_date: string;
  currency: string;
  lines: BudgetLineInput[];
}

export interface TreasuryPush {
  status: TreasuryPushStatus;
  budget_id?: string;
  error?: string;
  attempts?: number;
  attempted_at?: string;
}

export interface ChangeRequestMetadata {
  date_shifts?: DateShift[];
  budget?: BudgetBody;
  budget_id?: string;
  applied_task_ids?: string[];
  treasury?: TreasuryPush;
}

export interface ChangeRequest {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  kind: ChangeKind;
  status: ChangeStatus;
  requested_by: string;
  requested_by_name: string;
  decided_by?: string;
  decided_by_name: string;
  decided_at?: string;
  decision_comment?: string;
  metadata?: ChangeRequestMetadata;
  created_at: string;
  updated_at: string;
}

export interface ChangeRequestInput {
  title: string;
  description?: string;
  kind: ChangeKind;
  date_shifts?: DateShift[];
  budget?: BudgetBody | null;
  budget_id?: string;
}

export interface ChangeListParams {
  page?: number;
  limit?: number;
  status?: ChangeStatus | '';
}

// Templates.

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  system: boolean;
  task_count: number;
  phase_count: number;
  duration_days: number;
  created_at: string;
}

export interface TemplateRole {
  code: string;
  label: string;
  count: number;
}

export interface StartFromTemplateInput {
  start_date: string;
  name?: string;
  description?: string;
  currency?: string;
}

export interface StartFromTemplateResult {
  project: Project;
  task_count: number;
  milestone_count: number;
  roles: TemplateRole[];
}

export interface SaveAsTemplateInput {
  name: string;
  description?: string;
  category?: string;
}

// Task moves (task_tracking + project_automation).

export interface MoveCheck {
  status: string;
  allowed: boolean;
  reason?: 'transition_not_allowed' | 'missing_fields' | string;
  missing_fields: string[];
  message?: string;
}

const t = (orgSlug: string) => `/api/v1/${orgSlug}`;
const p = (orgSlug: string, projectId: string) => `/api/v1/${orgSlug}/projects/${projectId}`;

export const workloadApi = {
  get: (orgSlug: string, params: WorkloadParams) => apiClient.get<Workload>(`${t(orgSlug)}/workload`, params as Record<string, unknown>),
  tasks: (orgSlug: string, params: { user_id: string; week: string; include_done?: boolean }) =>
    apiClient.get<{ data: WorkloadTask[] }>(`${t(orgSlug)}/workload/tasks`, params).then((r) => r.data ?? []),
  settings: (orgSlug: string) => apiClient.get<WorkloadSettings>(`${t(orgSlug)}/workload/settings`),
  saveSettings: (orgSlug: string, body: WorkloadSettings) => apiClient.put<WorkloadSettings>(`${t(orgSlug)}/workload/settings`, body),
};

export const baselinesApi = {
  list: (orgSlug: string, projectId: string) =>
    apiClient.get<{ data: BaselineSummary[] }>(`${p(orgSlug, projectId)}/baselines`).then((r) => r.data ?? []),
  save: (orgSlug: string, projectId: string, body: { name?: string; note?: string }) =>
    apiClient.post<BaselineSummary>(`${p(orgSlug, projectId)}/baselines`, body),
  delete: (orgSlug: string, projectId: string, id: string) => apiClient.delete<void>(`${p(orgSlug, projectId)}/baselines/${id}`),
  slips: (orgSlug: string, projectId: string, baselineId?: string) =>
    apiClient.get<SlipsReport>(`${p(orgSlug, projectId)}/slips`, baselineId ? { baseline_id: baselineId } : undefined),
};

export const risksApi = {
  list: (orgSlug: string, projectId: string, params: RiskListParams) =>
    apiClient.get<PaginatedResponse<Risk>>(`${p(orgSlug, projectId)}/risks`, params as Record<string, unknown>),
  heatmap: (orgSlug: string, projectId: string, all = false) =>
    apiClient.get<RiskHeatMap>(`${p(orgSlug, projectId)}/risks/heatmap`, all ? { status: 'all' } : undefined),
  create: (orgSlug: string, projectId: string, body: RiskInput) => apiClient.post<Risk>(`${p(orgSlug, projectId)}/risks`, body),
  update: (orgSlug: string, projectId: string, id: string, body: RiskInput) =>
    apiClient.put<Risk>(`${p(orgSlug, projectId)}/risks/${id}`, body),
  delete: (orgSlug: string, projectId: string, id: string) => apiClient.delete<void>(`${p(orgSlug, projectId)}/risks/${id}`),
};

export const changesApi = {
  /** The tenant's requests across the projects the caller may see; status=pending is the approvals queue. */
  queue: (orgSlug: string, params: ChangeListParams) =>
    apiClient.get<PaginatedResponse<ChangeRequest>>(`${t(orgSlug)}/change-requests`, params as Record<string, unknown>),
  list: (orgSlug: string, projectId: string, params: ChangeListParams) =>
    apiClient.get<PaginatedResponse<ChangeRequest>>(`${p(orgSlug, projectId)}/change-requests`, params as Record<string, unknown>),
  get: (orgSlug: string, projectId: string, id: string) => apiClient.get<ChangeRequest>(`${p(orgSlug, projectId)}/change-requests/${id}`),
  create: (orgSlug: string, projectId: string, body: ChangeRequestInput) =>
    apiClient.post<ChangeRequest>(`${p(orgSlug, projectId)}/change-requests`, body),
  withdraw: (orgSlug: string, projectId: string, id: string) =>
    apiClient.post<ChangeRequest>(`${p(orgSlug, projectId)}/change-requests/${id}/withdraw`),
  approve: (orgSlug: string, projectId: string, id: string, comment: string) =>
    apiClient.post<ChangeRequest>(`${p(orgSlug, projectId)}/change-requests/${id}/approve`, comment ? { comment } : {}),
  reject: (orgSlug: string, projectId: string, id: string, comment: string) =>
    apiClient.post<ChangeRequest>(`${p(orgSlug, projectId)}/change-requests/${id}/reject`, { comment }),
  pushBudget: (orgSlug: string, projectId: string, id: string) =>
    apiClient.post<ChangeRequest>(`${p(orgSlug, projectId)}/change-requests/${id}/push-budget`),
};

export const templatesApi = {
  list: (orgSlug: string, params: { q?: string; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<TemplateSummary>>(`${t(orgSlug)}/project-templates`, params as Record<string, unknown>),
  delete: (orgSlug: string, id: string) => apiClient.delete<void>(`${t(orgSlug)}/project-templates/${id}`),
  start: (orgSlug: string, id: string, body: StartFromTemplateInput) =>
    apiClient.post<StartFromTemplateResult>(`${t(orgSlug)}/project-templates/${id}/projects`, body),
  saveFrom: (orgSlug: string, projectId: string, body: SaveAsTemplateInput) =>
    apiClient.post<TemplateSummary>(`${p(orgSlug, projectId)}/save-as-template`, body),
};

export const automationApi = {
  statusRules: (orgSlug: string, projectId: string) => apiClient.get<StatusRules>(`${p(orgSlug, projectId)}/status-rules`),
  saveStatusRules: (orgSlug: string, projectId: string, body: StatusRules) =>
    apiClient.put<StatusRules>(`${p(orgSlug, projectId)}/status-rules`, body),
  taskMoves: (orgSlug: string, projectId: string, taskId: string) =>
    apiClient.get<{ data: MoveCheck[] }>(`${p(orgSlug, projectId)}/task-moves/${taskId}`).then((r) => r.data ?? []),
  automations: (orgSlug: string, projectId: string) =>
    apiClient.get<{ data: AutomationRule[]; limit: number }>(`${p(orgSlug, projectId)}/automations`),
  saveAutomations: (orgSlug: string, projectId: string, automations: AutomationRule[]) =>
    apiClient.put<{ data: AutomationRule[]; limit: number }>(`${p(orgSlug, projectId)}/automations`, { automations }),
};
