// Client portal shapes (projects-api docs/api.md, "Client portal"). The client routes are built
// field by field: no budgets, hours, assignees or internal comments ever reach these types.

export interface PortalProject {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

/** A project's progress on the landing list, counted the same way as its summary. */
export interface PortalProgressCounts {
  tasks_total: number;
  tasks_done: number;
  percent: number;
  milestones_total: number;
  milestones_done: number;
  awaiting_review: number;
}

/** GET /portal/projects row: the project with its progress, so no card asks for a summary. */
export interface PortalProjectListItem extends PortalProject {
  progress: PortalProgressCounts;
}

export interface PortalMilestoneBrief {
  id: string;
  name: string;
  status: string;
  target_date: string | null;
}

export interface PortalSummary extends PortalProject {
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  total_milestones: number;
  completed_milestones: number;
  awaiting_review: number;
  next_milestone: PortalMilestoneBrief | null;
}

/**
 * A client's latest decision on a milestone, the same on the team's milestone list and in the
 * portal. decision is the outcome it set, not the verb the client sent.
 */
export interface MilestoneDecision {
  decision: 'approved' | 'changes_requested';
  comment: string;
  decided_at: string;
  decided_by_name: string;
}

export interface PortalMilestone {
  id: string;
  name: string;
  description: string;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  can_decide: boolean;
  last_decision: MilestoneDecision | null;
}

export interface PortalTask {
  id: string;
  title: string;
  description: string;
  status: string;
  status_label: string;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  completed_at: string | null;
}

export interface PortalFile {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  task_id: string | null;
  /** Signed for 15 minutes. */
  url: string;
}

/** A project invoice as the client sees it: sent or paid only, never a draft. */
export interface PortalInvoice {
  id: string;
  invoice_number: string;
  status: string;
  payment_status: string;
  currency: string;
  /** Numbers or decimal strings; read with moneyOf. */
  total_amount: number | string;
  amount_paid: number | string;
  amount_due: number | string;
  invoice_date: string;
  due_date: string;
  is_overdue: boolean;
  /** Treasury's public page, where the client can view and pay. */
  public_url?: string;
}

/** GET /portal/projects/{id}/invoices. available is false while billing is not connected; note says why. */
export interface PortalInvoices {
  data: PortalInvoice[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  available: boolean;
  note?: string;
}

/** A client thread entry, the same on the portal and the team side. */
export interface ThreadComment {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  /** client when the author is a client of the project, else team. */
  author_kind: 'client' | 'team';
  created_at: string;
  updated_at: string;
}

/** GET /projects/{id}/clients row. */
export interface ProjectClient {
  id: string;
  project_id: string;
  user_id: string | null;
  crm_contact_id: string;
  name: string;
  email_hint: string;
  status: 'invited' | 'active' | string;
  invited_at?: string;
  activated_at?: string;
}

export interface InviteResult {
  client: ProjectClient;
  resent: boolean;
}
