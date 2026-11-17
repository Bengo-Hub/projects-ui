// Tender rules the screens share (sprints 1 and 2). They mirror projects-api's tenders package
// (status.go, gonogo.go, sections.go, submissions.go, meta.go) so the forms say what the API would
// refuse before it is sent. No React, no aliases and no runtime imports, so node-tests can load
// this file directly.

export const TENDER_STATUSES = [
  'draft',
  'evaluating',
  'preparing',
  'no_go',
  'submitted',
  'under_review',
  'shortlisted',
  'awarded',
  'lost',
  'cancelled',
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const TENDER_STATUS_LABEL: Record<TenderStatus, string> = {
  draft: 'Draft',
  evaluating: 'Evaluating',
  preparing: 'Preparing the bid',
  no_go: 'No go',
  submitted: 'Submitted',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  awarded: 'Won',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

/**
 * The status to show for a tender. A value from before the current vocabulary (or a missing one)
 * shows as draft; the API offers it the moves back into the pipeline.
 */
export function displayStatus(status: string | null | undefined): TenderStatus {
  return (TENDER_STATUSES as readonly string[]).includes(status ?? '') ? (status as TenderStatus) : 'draft';
}

/** A readable status; anything unknown reads as Draft. */
export function tenderStatusLabel(status: string | null | undefined): string {
  return TENDER_STATUS_LABEL[displayStatus(status)];
}

/** The label of the button that makes a manual move to status. */
export function moveLabel(to: string): string {
  switch (to) {
    case 'evaluating':
      return 'Start evaluating';
    case 'draft':
      return 'Back to draft';
    case 'under_review':
      return 'Mark under review';
    case 'shortlisted':
      return 'Mark shortlisted';
    case 'cancelled':
      return 'Cancel tender';
    default:
      return `Move to ${tenderStatusLabel(to).toLowerCase()}`;
  }
}

/** Statuses in which the go/no-go decision can be made (again): before the bid goes out. */
export function canDecide(status: string): boolean {
  return ['draft', 'evaluating', 'preparing', 'no_go'].includes(status);
}

/** Statuses in which a submission can be recorded: the first after a go, later ones while out. */
export function canSubmit(status: string): boolean {
  return ['preparing', 'submitted', 'under_review', 'shortlisted'].includes(status);
}

/** Statuses in which the award or loss can be recorded. */
export function canRecordOutcome(status: string): boolean {
  return ['submitted', 'under_review', 'shortlisted'].includes(status);
}

/** Sections can change until the tender is won, lost, cancelled or a no go. */
export function sectionsOpen(status: string): boolean {
  return !['awarded', 'lost', 'cancelled', 'no_go'].includes(status);
}

export const SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: 'deadline', label: 'Deadline, soonest' },
  { value: '-deadline', label: 'Deadline, latest' },
  { value: '-estimated_value', label: 'Value, highest' },
  { value: 'estimated_value', label: 'Value, lowest' },
] as const;

// Go/no-go.

export const MAX_CRITERION_SCORE = 5;
export const DEFAULT_GO_THRESHOLD = 65;
const REVIEW_BAND = 15;

export interface Criterion {
  key: string;
  label: string;
  weight: number;
  score: number;
  note?: string;
}

export type Recommendation = 'go' | 'review' | 'no_go';

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = { go: 'Go', review: 'Needs a closer look', no_go: 'No go' };

export interface Scored {
  weighted_score: number;
  recommendation: Recommendation;
  threshold: number;
}

/**
 * The weighted score out of 100 (one decimal) and the recommendation, as projects-api's Score:
 * go at or above the threshold, review within 15 points below it, no go under that. Null when the
 * criteria cannot be scored (no criteria or no weight).
 */
export function scoreCriteria(criteria: readonly Criterion[], threshold = DEFAULT_GO_THRESHOLD): Scored | null {
  let weights = 0;
  let total = 0;
  for (const c of criteria) {
    if (!(c.weight > 0)) continue;
    weights += c.weight;
    total += c.weight * c.score;
  }
  if (weights === 0) return null;
  const t = threshold || DEFAULT_GO_THRESHOLD;
  const score = Math.round((total / (weights * MAX_CRITERION_SCORE)) * 1000) / 10;
  const recommendation: Recommendation = score >= t ? 'go' : score >= t - REVIEW_BAND ? 'review' : 'no_go';
  return { weighted_score: score, recommendation, threshold: t };
}

/** What stops a decision being sent, or null: the API's own rules, worded for the form. */
export function decisionError(criteria: readonly Criterion[], decision: string, comment: string, threshold = DEFAULT_GO_THRESHOLD): string | null {
  if (criteria.length === 0) return 'Score at least one criterion.';
  if (criteria.length > 20) return 'Score at most 20 criteria.';
  const keys = new Set<string>();
  for (const c of criteria) {
    const key = c.key.trim();
    if (!key) return 'Every criterion needs a name.';
    if (keys.has(key)) return `"${c.label || key}" appears twice.`;
    keys.add(key);
    if (!(c.weight > 0) || c.weight > 100) return `"${c.label || key}" needs a weight above 0 and at most 100.`;
    if (!(c.score >= 0) || c.score > MAX_CRITERION_SCORE) return `"${c.label || key}" needs a score from 0 to ${MAX_CRITERION_SCORE}.`;
  }
  if (!(threshold >= 1 && threshold <= 100)) return 'The threshold is between 1 and 100.';
  if (decision !== 'go' && decision !== 'no_go') return 'Choose go or no go.';
  const scored = scoreCriteria(criteria, threshold);
  if (comment.length > 2000) return 'The comment is at most 2000 characters.';
  if (scored && decision !== scored.recommendation && comment.trim() === '') {
    return 'Say why: the decision differs from the recommendation.';
  }
  return null;
}

/** A criterion key from its label, for criteria the decision maker adds. */
export function criterionKey(label: string, taken: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'criterion';
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}_${i}`;
  return key;
}

// Sections.

export const SECTION_STATUSES = ['not_started', 'in_progress', 'in_review', 'changes_requested', 'approved'] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

export const SECTION_STATUS_LABEL: Record<SectionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
};

export interface SectionSummary {
  total: number;
  by_status: Record<string, number>;
  ready: boolean;
}

/** Counts sections by status; ready when there is at least one and every one is approved. */
export function summarizeSections(statuses: readonly string[]): SectionSummary {
  const by_status: Record<string, number> = {};
  for (const s of SECTION_STATUSES) by_status[s] = 0;
  for (const s of statuses) by_status[s] = (by_status[s] ?? 0) + 1;
  return { total: statuses.length, by_status, ready: statuses.length > 0 && by_status.approved === statuses.length };
}

export interface SectionLike {
  status: string;
  assignee_id?: string | null;
  reviewer_id?: string | null;
}

/**
 * What the signed-in user may do with a section, as the API decides: the assignee or a tender
 * manager works on it and submits it; its reviewer or a tender manager reviews it, never its
 * assignee.
 */
export function sectionActions(s: SectionLike, me: string, canManage: boolean) {
  const mine = !!me && s.assignee_id === me;
  const reviewer = !!me && s.reviewer_id === me;
  const open = ['not_started', 'in_progress', 'changes_requested'].includes(s.status);
  return {
    canWork: (mine || canManage) && open,
    canSubmit: (mine || canManage) && open,
    canReview: s.status === 'in_review' && !mine && (reviewer || canManage),
    canEdit: canManage,
  };
}

// Submissions.

export const SUBMISSION_METHODS = ['online', 'email', 'physical'] as const;
export type SubmissionMethod = (typeof SUBMISSION_METHODS)[number];

export const SUBMISSION_METHOD_LABEL: Record<SubmissionMethod, string> = { online: 'Online portal', email: 'Email', physical: 'Physical delivery' };

const emailPattern = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;

/** What stops a submission being recorded, or null. */
export function submissionError(method: string, recipient: string): string | null {
  if (!(SUBMISSION_METHODS as readonly string[]).includes(method)) return 'Choose how the bid went out.';
  const r = recipient.trim();
  if (method === 'email' && !emailPattern.test(r)) return 'Give the email address the bid went to.';
  if (method === 'physical' && !r) return 'Give the address it was delivered to.';
  if (r.length > 500) return 'The recipient is at most 500 characters.';
  return null;
}

// Bid budget.

export const BUDGET_CATEGORIES = ['expense', 'revenue', 'capex'] as const;

const amountPattern = /^\d{1,14}(\.\d{1,2})?$/;

/** What is wrong with a bid budget line, or null (a name, a category, an amount of zero or more). */
export function bidLineError(line: { name: string; category?: string; planned_amount: string }): string | null {
  const name = line.name.trim();
  if (!name || name.length > 200) return 'Each line needs a name (at most 200 characters).';
  if (line.category && !(BUDGET_CATEGORIES as readonly string[]).includes(line.category)) return 'Unknown category.';
  if (!amountPattern.test(line.planned_amount.trim())) return 'Amounts are zero or more with at most two decimal places.';
  return null;
}

/** The total of the bid budget lines, in cents to avoid float drift, back to a number. */
export function bidTotal(lines: readonly { planned_amount: string }[]): number {
  let cents = 0;
  for (const l of lines) {
    const n = Number(l.planned_amount);
    if (Number.isFinite(n)) cents += Math.round(n * 100);
  }
  return cents / 100;
}

/** The first error in a bid budget's lines, numbered from 1, or null. */
export function bidBudgetError(lines: readonly { name: string; category?: string; planned_amount: string }[]): string | null {
  if (lines.length > 200) return 'A bid budget has at most 200 lines.';
  for (let i = 0; i < lines.length; i++) {
    const err = bidLineError(lines[i]);
    if (err) return `Line ${i + 1}: ${err}`;
  }
  return null;
}

// Tags.

export const MAX_TAGS = 20;

/** Adds a tag (trimmed, once, case-insensitive): the new list, or an error to show. */
export function addTag(tags: readonly string[], raw: string): { tags: string[]; error: string | null } {
  const tag = raw.trim();
  if (!tag) return { tags: [...tags], error: null };
  if (tag.length > 50) return { tags: [...tags], error: 'A tag is at most 50 characters.' };
  if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return { tags: [...tags], error: null };
  if (tags.length >= MAX_TAGS) return { tags: [...tags], error: `At most ${MAX_TAGS} tags.` };
  return { tags: [...tags, tag], error: null };
}

/**
 * The partial update of a tender edit: only the fields that changed. Metadata keys go only when
 * they changed, with null to remove one, as projects-api merges metadata.
 */
export function tenderPatch(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  metaBefore: Record<string, unknown>,
  metaAfter: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (JSON.stringify(after[k] ?? null) !== JSON.stringify(before[k] ?? null)) out[k] = after[k];
  }
  const norm = (v: unknown) => (v == null || v === '' || (Array.isArray(v) && v.length === 0) ? null : v);
  const meta: Record<string, unknown> = {};
  for (const k of Object.keys(metaAfter)) {
    const a = norm(metaAfter[k]);
    if (JSON.stringify(a) !== JSON.stringify(norm(metaBefore[k]))) meta[k] = a;
  }
  if (Object.keys(meta).length > 0) out.metadata = meta;
  return out;
}

// Conversion.

export const BUDGET_STATE_LABEL: Record<string, string> = {
  not_needed: 'No bid budget to send',
  not_allowed: 'Not created: needs project financials and permission to manage budgets',
  skipped: 'Skipped at conversion',
  pending: 'Waiting to be sent to treasury',
  pushing: 'Being sent to treasury',
  created: 'Draft budget created in treasury',
  failed: 'Treasury did not take it',
};

/** Whether a retry of the conversion budget push makes sense for this state. */
export function canRetryBudget(status: string | undefined): boolean {
  return status === 'pending' || status === 'failed';
}

export const BILLING_TYPES = ['fixed', 'time_and_materials', 'retainer', 'non_billable'] as const;
export const BILLING_LABEL: Record<(typeof BILLING_TYPES)[number], string> = {
  fixed: 'Fixed price',
  time_and_materials: 'Time and materials',
  retainer: 'Retainer',
  non_billable: 'Not billable',
};
