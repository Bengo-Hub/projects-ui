import type { MilestoneDecision } from './portal';
import type { GanttBaseline } from '@/lib/api/planning';

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  status: string; // active, on_hold, completed, cancelled
  start_date?: string;
  end_date?: string;
  budget?: number;
  currency: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  /** GET /projects/{id} loads members and milestones; tasks come from the paged tasks list. */
  edges?: {
    members?: ProjectMember[];
    milestones?: Milestone[];
  };
}

export interface Task {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  description?: string;
  /** A key of the project's statuses (GET /projects/{id}/statuses). */
  status: string;
  priority: string; // low, medium, high, critical
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  progress_pct?: number;
  completed_at?: string;
  parent_id?: string;
  wbs_code?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  edges?: {
    dependencies?: TaskDependency[];
    /** Everyone assigned, primary first. */
    assignees?: TaskAssignee[];
    /** Set on My Work rows, which span projects. */
    project?: { id: string; name: string };
  };
}

export interface TaskAssignee {
  user_id: string;
  is_primary: boolean;
}

/** One board column: category groups statuses for progress and My Work. */
export interface ProjectStatus {
  key: string;
  label: string;
  category: 'todo' | 'in_progress' | 'done';
  order: number;
}

export interface BoardCount {
  status: string;
  count: number;
}

export type MyWorkBucket = 'overdue' | 'today' | 'week' | 'later';
export type MyWorkCounts = Record<MyWorkBucket, number>;

/** A checklist line kept in task metadata under "checklist". */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** A stored file with a signed download link (15 minutes). */
export interface Attachment {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  url: string;
  /** Server owned; client_visible true shares the file in the client portal. */
  metadata?: Record<string, unknown>;
}

/** POST /attachments/uploads: where to PUT the file, then confirm with key. */
export interface UploadTicket {
  key: string;
  upload: { url: string; method: string; headers: Record<string, string>; expires_at?: string };
  max_bytes: number;
  allowed_types: string[];
}

/** GET /projects/{id}/tasks/{taskId}: the task, its latest 50 comments oldest first, and the count. */
export interface TaskDetail extends Task {
  comments: Comment[];
  comments_total: number;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string; // FS, SS, FF, SF
  created_at: string;
}

export interface Milestone {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  description?: string;
  target_date?: string;
  /**
   * pending, in_progress, completed, missed; ready_for_review (set by the team), approved and
   * changes_requested (set only by a client's decision in the portal).
   */
  status: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  /** The client's latest decision from the portal, null when no client decided. */
  last_decision?: MilestoneDecision | null;
}

export interface ProjectMember {
  id: string;
  tenant_id: string;
  project_id: string;
  user_id: string;
  role_code: string;
  joined_at: string;
  left_at?: string;
  /** From the API's copy of the SSO identity; empty until the person first signs in to projects. */
  name: string;
  email: string;
}

export interface Comment {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id?: string;
  user_id: string;
  /** The author's name, empty for someone who never signed in to projects. */
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id?: string;
  user_id: string;
  /** Who made the change; empty for a service call or someone who never signed in to projects. */
  actor_name: string;
  activity_type: string;
  payload?: Record<string, unknown>;
  occurred_at: string;
}

export interface Tender {
  id: string;
  tenant_id: string;
  number: string;
  title: string;
  client_name: string;
  source?: string;
  /** draft, evaluating, preparing, no_go, submitted, under_review, shortlisted, awarded, lost, cancelled */
  status: string;
  priority: string; // low, medium, high, critical
  estimated_value?: number;
  currency: string;
  deadline?: string;
  description?: string;
  submission_type: string; // physical, email, online
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  metadata?: TenderMetadata;
  /** GET /tenders/{id} only: the manual status moves open to the tender now. */
  allowed_moves?: string[];
  /** GET /tenders/{id} only: whether the caller may open the project the tender became. */
  can_open_project?: boolean;
}

export interface BidBudgetLine {
  name: string;
  category?: 'expense' | 'revenue' | 'capex';
  planned_amount: string;
  notes?: string;
}

export interface TenderCriterion {
  key: string;
  label: string;
  weight: number;
  score: number;
  note?: string;
}

export interface TenderGoDecision {
  criteria: TenderCriterion[];
  weighted_score: number;
  threshold: number;
  recommendation: 'go' | 'review' | 'no_go';
  decision: 'go' | 'no_go';
  comment?: string;
  decided_by: string;
  decided_at: string;
  evaluations?: { count: number; average_score: number };
}

export interface TenderOutcome {
  outcome: 'won' | 'lost';
  award_value?: number;
  award_date?: string;
  contract_reference?: string;
  contract_start?: string;
  contract_end?: string;
  loss_reason?: string;
  competitor?: string;
  competitor_price?: number;
  lessons?: string;
  recorded_by?: string;
  recorded_at: string;
}

export interface TenderBudgetState {
  status: 'not_needed' | 'not_allowed' | 'skipped' | 'pending' | 'pushing' | 'created' | 'failed';
  budget_id?: string;
  attempts?: number;
  error?: string;
  attempted_at?: string;
}

export interface TenderConversion {
  project_id: string;
  project_name: string;
  converted_at: string;
  converted_by: string;
  members_added: number;
  documents_linked: number;
  template_id?: string;
  template_name?: string;
  budget?: TenderBudgetState;
}

/** Tender metadata: the user-set keys and the server-owned decision, outcome and conversion. */
export interface TenderMetadata {
  crm_contact_id?: string;
  crm_contact_name?: string;
  tags?: string[];
  bid_budget?: { lines: BidBudgetLine[] };
  go_decision?: TenderGoDecision;
  go_decision_history?: TenderGoDecision[];
  outcome?: TenderOutcome;
  conversion?: TenderConversion;
}

export interface TenderEvaluationSummary {
  count: number;
  average_score: number;
  min_score: number;
  max_score: number;
  evaluators: { evaluator_id: string; name: string; score: number; evaluated_at: string }[];
  default_criteria: TenderCriterion[];
  criteria_note: string;
  default_threshold: number;
}

export interface TenderSection {
  id: string;
  tender_id: string;
  title: string;
  description?: string;
  position: number;
  assignee_id?: string | null;
  reviewer_id?: string | null;
  due_date?: string | null;
  status: string;
  document_id?: string | null;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_comment?: string;
  assignee_name: string;
  reviewer_name: string;
  created_at: string;
  updated_at: string;
}

export interface TenderSectionSummary {
  total: number;
  by_status: Record<string, number>;
  ready: boolean;
}

export interface TenderSubmission {
  id: string;
  tender_id: string;
  method: 'online' | 'email' | 'physical';
  submitted_at: string;
  submitted_by: string;
  submitted_by_name: string;
  recipient?: string;
  reference?: string;
  courier?: string;
  notes?: string;
  document_id?: string | null;
  proof_document_id?: string | null;
  metadata?: { resubmission?: boolean; email_subject?: string; sections_overridden?: boolean };
  created_at: string;
}

export interface TenderDocument {
  id: string;
  tender_id: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by: string;
  uploaded_at: string;
  /** A signed link for a stored file, or the link itself. */
  url: string;
  stored: boolean;
}

export interface TenderConvertResult {
  project: Project;
  tender: Tender;
  already_converted: boolean;
  members_added: number;
  documents_linked: number;
  template: { id: string; name: string; task_count: number; milestone_count: number } | null;
  budget: TenderBudgetState | null;
}

export interface TenderCommittee {
  id: string;
  tender_id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  edges?: {
    members?: TenderCommitteeMember[];
  };
}

export interface TenderCommitteeMember {
  id: string;
  committee_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  /** From projects_users on the list; empty for someone who never signed in. */
  user_name?: string;
  email?: string;
}

export interface TenderEvaluation {
  id: string;
  tender_id: string;
  tenant_id: string;
  evaluator_id: string;
  score: number;
  notes?: string;
  criteria?: string;
  evaluated_at: string;
}

export interface TenderMeeting {
  id: string;
  tender_id: string;
  tenant_id: string;
  title: string;
  scheduled_at: string;
  platform: string;
  meeting_url?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface TenderStatusMetric {
  count: number;
  value: number;
}

export interface TenderMetrics {
  total: number;
  by_status: Record<string, TenderStatusMetric>;
  total_estimated_value: number;
  win_rate: number;
  pipeline_value: number;
  awarded_value: number;
}

/** Project counts by status for the whole tenant (GET /projects/metrics). */
export interface ProjectMetrics {
  total: number;
  by_status: Record<string, number>;
}

/** One month of task flow (GET /tasks/trend). */
export interface TaskTrendMonth {
  month: string; // YYYY-MM
  created: number;
  completed: number;
  overdue_at_month_end: number;
}

/** The shared pagination envelope (projects, tasks, tenders and both comment lists). */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  page: number;
  hasMore: boolean;
}

/** A plain list answer ({data}) for routes that do not page. */
export interface ListResponse<T> {
  data: T[];
}

export interface GanttTask extends Task {
  /** On the critical path over finish-to-start links. */
  critical: boolean;
}

/** GET /projects/{id}/gantt: tasks with edges.dependencies, capped at limit (2000). */
export interface GanttResponse {
  data: GanttTask[];
  truncated: boolean;
  limit: number;
  /** Length of the critical path in days. */
  critical_days: number;
  /** Sprint 16: the baseline drawn under the live bars; null without one or without baselines.view. */
  baseline?: GanttBaseline | null;
}

export interface ProjectSummary {
  project_id: string;
  name: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  tasks_by_status: Record<string, number>;
  progress: number;
  total_members: number;
  total_milestones: number;
}
