// Project governance (sprint 7, US-7.1): governance roles, the RACI matrix and the decision log
// (projects-api `internal/services/governance`, contract in projects-api/docs/api.md).

export type GovernanceRoleKind =
  | 'sponsor'
  | 'steering_committee'
  | 'project_board'
  | 'project_manager'
  | 'quality_assurance'
  | 'stakeholder'
  | 'other';

/** One governance seat: a teammate (user_id) or someone outside (person_name, organisation). */
export interface GovernanceRole {
  id: string;
  project_id?: string;
  role: GovernanceRoleKind;
  title: string;
  user_id?: string | null;
  user_name?: string;
  person_name: string;
  organisation: string;
  /** Sanitised rich text. */
  responsibilities: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

/** POST, or PUT as a patch; on a patch user_id "" clears the teammate. */
export interface GovernanceRoleInput {
  role?: GovernanceRoleKind;
  title?: string;
  user_id?: string;
  person_name?: string;
  organisation?: string;
  responsibilities?: string;
}

export interface RaciEntry {
  id: string;
  project_id?: string;
  activity: string;
  task_id?: string | null;
  task_title?: string;
  accountable_id: string;
  responsible_ids?: string[] | null;
  consulted_ids?: string[] | null;
  informed_ids?: string[] | null;
  position: number;
  /** user id to name for everyone on the row. */
  people?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

export interface RaciInput {
  activity?: string;
  task_id?: string;
  accountable_id?: string;
  responsible_ids?: string[];
  consulted_ids?: string[];
  informed_ids?: string[];
  position?: number;
}

export type DecisionStatus = 'proposed' | 'approved' | 'rejected' | 'superseded';
export type DecisionImpact = '' | 'scope' | 'schedule' | 'cost' | 'quality' | 'other';

export interface DecisionApproval {
  user_id: string;
  decision: 'approve' | 'reject';
  comment?: string;
  at: string;
}

export interface Decision {
  id: string;
  project_id?: string;
  number: number;
  title: string;
  /** Rich text. */
  context: string;
  /** Rich text: what was decided. */
  decision: string;
  /** Rich text. */
  rationale: string;
  impact: DecisionImpact;
  status: DecisionStatus;
  proposed_by: string;
  approver_ids?: string[] | null;
  approvals?: DecisionApproval[] | null;
  decided_at?: string | null;
  superseded_by?: string | null;
  /** user id to name for the proposer and the approvers. */
  people?: Record<string, string>;
  created_at: string;
  updated_at?: string;
}

export interface DecisionInput {
  title?: string;
  context?: string;
  decision?: string;
  rationale?: string;
  impact?: DecisionImpact;
  approver_ids?: string[];
}

export interface DecisionListParams {
  page?: number;
  limit?: number;
  status?: DecisionStatus;
}
