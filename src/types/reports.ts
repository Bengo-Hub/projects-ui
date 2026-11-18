// Status reports (sprint 7, projects-api `internal/services/statusreports`, contract in
// projects-api/docs/api.md "Governance and reporting"). Every section is a snapshot taken when the
// draft was filled, so a published report never changes when the project does.

/** A rating, or "" for not rated. */
export type Rag = 'green' | 'amber' | 'red' | '';

export type ReportStatus = 'draft' | 'published';

export interface ReportKpis {
  tasks_total: number;
  tasks_done: number;
  tasks_overdue: number;
  tasks_completed_in_period: number;
  percent_complete: number;
  percent_planned: number;
  /** Earned over planned work; absent or null while nothing is planned. */
  schedule_index?: number | null;
  milestones_total: number;
  milestones_done: number;
  milestones_overdue: number;
  open_risks: number;
  high_risks: number;
  pending_change_requests: number;
  pending_scope_changes: number;
}

/** One risk as the report shows it. The portal's copy carries no risk_id. */
export interface ReportRisk {
  risk_id?: string | null;
  title: string;
  likelihood: number;
  impact: number;
  score: number;
  status: string;
  owner_name?: string;
  mitigation?: string;
}

export interface ReportMilestone {
  milestone_id: string;
  name: string;
  target_date?: string | null;
  status: string;
  overdue: boolean;
}

/** The money snapshot; only for a reader with financial access (or a client the PM shared it with). */
export interface ReportFinancials {
  currency: string;
  bac: number;
  ac: number;
  ev: number;
  pv: number;
  eac: number;
  etc: number;
  vac: number;
  cpi: number;
  spi: number;
  percent_spent: number;
  committed: number;
  revenue: number;
  margin: number;
  margin_pct: number;
  health: string;
  health_reason?: string;
  /** Treasury was down when the snapshot was taken. */
  treasury_error?: string;
}

export interface ReportSuggestion {
  overall: Rag;
  schedule: Rag;
  cost: Rag;
  scope: Rag;
  reasons?: { schedule?: string; cost?: string; scope?: string };
}

/** A report row as the team reads it (GET /projects/{id}/status-reports/{rid}). */
export interface StatusReport {
  id: string;
  tenant_id?: string;
  project_id: string;
  title: string;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  rag_overall: Rag;
  rag_schedule: Rag;
  rag_cost: Rag;
  rag_scope: Rag;
  /** Sanitised rich text. */
  narrative: string;
  highlights?: string[] | null;
  risks?: ReportRisk[] | null;
  milestones?: ReportMilestone[] | null;
  kpis?: ReportKpis | null;
  financials?: ReportFinancials | null;
  suggested?: ReportSuggestion | null;
  filled_at?: string | null;
  client_visible: boolean;
  include_financials: boolean;
  shared_at?: string | null;
  shared_by?: string | null;
  published_at?: string | null;
  published_by?: string | null;
  created_by?: string;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  project_name?: string;
  created_by_name?: string;
  published_by_name?: string;
  shared_by_name?: string;
  /** A snapshot exists but this reader may not see it. */
  financials_hidden?: boolean;
}

export interface ReportListParams {
  page?: number;
  limit?: number;
  status?: ReportStatus;
}

/** POST /status-reports. Without dates the API takes the last full week. */
export interface ReportCreateInput {
  period_start?: string;
  period_end?: string;
  title?: string;
}

/** PUT /status-reports/{rid}: any of these; a list replaces the list. */
export interface ReportUpdateInput {
  title?: string;
  rag_overall?: Rag;
  rag_schedule?: Rag;
  rag_cost?: Rag;
  rag_scope?: Rag;
  narrative?: string;
  highlights?: string[];
  risks?: ReportRisk[];
  milestones?: ReportMilestone[];
}

/** GET/PUT /settings/digest. */
export interface DigestSettings {
  weekly_enabled: boolean;
}

/** A shared report as the client reads it in the portal: no authors and no suggestion. */
export interface PortalReport {
  id: string;
  project_id: string;
  project_name?: string;
  title: string;
  period_start: string;
  period_end: string;
  rag_overall: Rag;
  rag_schedule: Rag;
  /** Only when the project manager included financials. */
  rag_cost?: Rag;
  rag_scope: Rag;
  narrative: string;
  highlights?: string[] | null;
  risks?: ReportRisk[] | null;
  milestones?: ReportMilestone[] | null;
  kpis?: ReportKpis | null;
  financials?: ReportFinancials | null;
  published_at?: string | null;
  shared_at?: string | null;
}
