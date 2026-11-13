// QA and acceptance types, matching projects-api (internal/services/qa and the ent schemas).
// ent leaves out empty fields (omitempty), so most fields are optional here.

export type QATemplateKind = 'software' | 'project' | 'general';
export type QATemplateStatus = 'draft' | 'active' | 'archived';
export type QACriterionSubject = 'feature' | 'milestone' | 'task' | 'none';
export type QAWeight = 'must' | 'should' | 'could';
export type QASessionSubject = 'service' | 'project' | 'general';
export type QASessionStatus = 'draft' | 'open' | 'closed' | 'accepted' | 'rejected';
export type QARole = 'tester' | 'signer' | 'observer';
export type QAInviteStatus = 'invited' | 'active' | 'revoked';
export type QAResultValue = 'pass' | 'fail' | 'blocked' | 'not_run';
export type QADefectStatus = 'open' | 'ticketed' | 'ticket_failed';

export interface QAPassRule {
  require_all_must?: boolean;
  blocking_severities?: number[];
  min_score?: number;
  weights?: Partial<Record<QAWeight, number>>;
}

export interface QACriterion {
  id: string;
  template_id?: string;
  tenant_id?: string;
  subject_kind?: QACriterionSubject;
  subject_ref?: string;
  area_code?: string;
  title: string;
  requirement_ref?: string;
  preconditions?: string;
  steps?: string;
  expected_result?: string;
  weight?: QAWeight;
  automated_ref?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

/** A criterion to add or replace (POST and PUT criteria). */
export interface QACriterionInput {
  subject_kind: QACriterionSubject;
  subject_ref?: string;
  area_code?: string;
  title: string;
  requirement_ref?: string;
  preconditions?: string;
  steps?: string;
  expected_result?: string;
  weight: QAWeight;
  automated_ref?: string;
  sort_order?: number;
}

export interface QATemplate {
  id: string;
  /** Empty for a platform template. */
  tenant_id?: string;
  name: string;
  kind?: QATemplateKind;
  service_tag?: string;
  version?: number;
  status?: QATemplateStatus;
  needs_review?: boolean;
  pass_rule?: QAPassRule;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  edges?: { criteria?: QACriterion[] };
}

/** One criterion as frozen on a session. */
export interface QASnapshotCriterion {
  id: string;
  area_code?: string;
  title: string;
  subject_kind: QACriterionSubject;
  subject_ref?: string;
  requirement_ref?: string;
  preconditions?: string;
  steps?: string;
  expected_result?: string;
  weight: QAWeight;
  automated_ref?: string;
  sort_order: number;
}

export interface QASession {
  id: string;
  tenant_id?: string;
  template_id?: string;
  template_version?: number;
  title: string;
  subject_kind?: QASessionSubject;
  subject_ref?: string;
  criteria_snapshot?: QASnapshotCriterion[];
  pass_rule?: QAPassRule;
  status?: QASessionStatus;
  share_code?: string;
  owner_id?: string;
  opened_at?: string;
  closed_at?: string;
  document_hash?: string;
  metadata?: Record<string, unknown> & {
    decision?: { status?: string; reason?: string; at?: string };
    template_name?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface QACriterionOutcome {
  id: string;
  area_code?: string;
  title: string;
  weight: QAWeight;
  status: QAResultValue;
  severity?: number;
  testers: number;
}

export interface QAOutcome {
  accepted: boolean;
  score: number;
  counts: Partial<Record<QAResultValue, number>>;
  must_total: number;
  must_passed: number;
  open_blocking: number;
  reasons: string[];
  criteria: QACriterionOutcome[];
}

export interface QAInvite {
  id: string;
  session_id?: string;
  email_hint?: string;
  name?: string;
  role?: QARole;
  status?: QAInviteStatus;
  last_seen_at?: string;
  invited_by?: string;
  created_at?: string;
}

export interface QAResult {
  id: string;
  session_id?: string;
  criterion_id: string;
  tester_hint?: string;
  tester_user_id?: string;
  invite_id?: string;
  result: QAResultValue;
  severity?: number;
  device?: string;
  notes?: string;
  defect_id?: string;
  is_current?: boolean;
  created_at?: string;
}

export interface QADefect {
  id: string;
  session_id?: string;
  criterion_id: string;
  first_result_id?: string;
  severity: number;
  status?: QADefectStatus;
  ticket_id?: string;
  ticket_number?: string;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QAFeature {
  featureCode: string;
  serviceTag: string;
  category: string;
  label: string;
  description?: string;
  module?: string;
  shippedAt?: string;
}

export interface QAFeatureCatalog {
  data: QAFeature[];
  /** false until projects-api reads the catalogue (QA_CATALOG_ENABLED). */
  available: boolean;
}

export interface QAPage<T> {
  data: T[];
  total: number;
  limit?: number;
  page?: number;
  hasMore?: boolean;
}

export interface QAList<T> {
  data: T[];
}

export interface QARecordOutcome {
  result: QAResult;
  defect?: QADefect;
}

// Invitee side.

export interface QAAccessInfo {
  tenant_slug?: string;
  methods: string[];
}

export interface QAAccessGrant {
  access_token: string;
  expires_at: string;
  session_id: string;
  role: QARole;
}

export interface QAInviteeSession {
  session_id: string;
  title: string;
  status: QASessionStatus;
  role: QARole;
  criteria: QASnapshotCriterion[];
  my_results: QAResult[] | null;
  outcome?: QAOutcome;
}

/** The body of a verdict, on both the tenant and the invitee routes. */
export interface QAVerdictInput {
  result: QAResultValue;
  severity?: number | null;
  notes?: string;
  device?: string;
}
