// Governance rules the screens share (sprint 7, US-7.1): seats, the RACI matrix and the decision
// log. No React, no aliases and no runtime imports, so node-tests can load this file directly.
// projects-api checks every rule again.

import type { Decision, DecisionImpact, DecisionStatus, GovernanceRoleKind, RaciEntry } from '@/types/governance';

export const ROLE_KINDS: readonly GovernanceRoleKind[] = [
  'sponsor',
  'steering_committee',
  'project_board',
  'project_manager',
  'quality_assurance',
  'stakeholder',
  'other',
];

export const ROLE_KIND_LABEL: Record<GovernanceRoleKind, string> = {
  sponsor: 'Sponsor',
  steering_committee: 'Steering committee',
  project_board: 'Project board',
  project_manager: 'Project manager',
  quality_assurance: 'Quality assurance',
  stakeholder: 'Stakeholder',
  other: 'Other',
};

export function roleKindLabel(code: string): string {
  return ROLE_KIND_LABEL[code as GovernanceRoleKind] ?? code;
}

export const MAX_RACI_PEOPLE = 50;
export const MAX_APPROVERS = 20;
export const MAX_NAME_CHARS = 200;

/** Why a seat cannot be saved, or null: a teammate or an outside person's name is required. */
export function seatError(f: { role: string; user_id: string; person_name: string }): string | null {
  if (!ROLE_KINDS.includes(f.role as GovernanceRoleKind)) return 'Pick the governance role.';
  if (!f.user_id && !f.person_name.trim()) return 'Pick a teammate or type the name of the person outside the team.';
  if ([...f.person_name.trim()].length > MAX_NAME_CHARS) return `A name is at most ${MAX_NAME_CHARS} characters.`;
  return null;
}

/** Who sits in a seat: the teammate's name, else the outside person with their organisation. */
export function seatHolder(r: { user_id?: string | null; user_name?: string; person_name?: string; organisation?: string }): string {
  if (r.user_id) return r.user_name || 'A teammate';
  const name = (r.person_name ?? '').trim();
  const org = (r.organisation ?? '').trim();
  if (name && org) return `${name}, ${org}`;
  return name || org || 'Not named';
}

export type RaciLetter = 'A' | 'R' | 'C' | 'I';

export const RACI_LETTER_LABEL: Record<RaciLetter, string> = {
  A: 'Accountable',
  R: 'Responsible',
  C: 'Consulted',
  I: 'Informed',
};

export interface RaciDraft {
  activity: string;
  accountable_id: string;
  responsible_ids: string[];
  consulted_ids: string[];
  informed_ids: string[];
}

/**
 * Why a RACI row cannot be saved, or null. Exactly one accountable and at least one responsible;
 * one letter per person, except that the accountable may also be responsible.
 */
export function raciError(d: RaciDraft): string | null {
  if (!d.activity.trim()) return 'Name the activity.';
  if (!d.accountable_id) return 'Pick the one person accountable.';
  if (d.responsible_ids.length === 0) return 'Pick at least one person responsible.';
  const lists: [RaciLetter, string[]][] = [
    ['R', d.responsible_ids],
    ['C', d.consulted_ids],
    ['I', d.informed_ids],
  ];
  for (const [, ids] of lists) {
    if (ids.length > MAX_RACI_PEOPLE) return `A letter holds at most ${MAX_RACI_PEOPLE} people.`;
  }
  if (d.consulted_ids.includes(d.accountable_id) || d.informed_ids.includes(d.accountable_id)) {
    return 'The accountable person can only also be responsible, not consulted or informed.';
  }
  const seen = new Set<string>();
  for (const [, ids] of lists) {
    for (const id of new Set(ids)) {
      if (seen.has(id)) return 'Each person holds one letter on a row (the accountable person may also be responsible).';
      seen.add(id);
    }
  }
  return null;
}

/** The draft of a saved row, for the edit dialog. */
export function raciDraftOf(e: RaciEntry | null): RaciDraft {
  return {
    activity: e?.activity ?? '',
    accountable_id: e?.accountable_id ?? '',
    responsible_ids: [...(e?.responsible_ids ?? [])],
    consulted_ids: [...(e?.consulted_ids ?? [])],
    informed_ids: [...(e?.informed_ids ?? [])],
  };
}

/** A row's letters with the people holding each, accountable first. */
export function raciColumns(e: RaciEntry): { letter: RaciLetter; ids: string[] }[] {
  return [
    { letter: 'A', ids: e.accountable_id ? [e.accountable_id] : [] },
    { letter: 'R', ids: e.responsible_ids ?? [] },
    { letter: 'C', ids: e.consulted_ids ?? [] },
    { letter: 'I', ids: e.informed_ids ?? [] },
  ];
}

export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  proposed: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Superseded',
};

export const DECISION_STATUS_CLASS: Record<DecisionStatus, string> = {
  proposed: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
  superseded: 'border border-border text-muted-foreground',
};

export const DECISION_IMPACTS: readonly Exclude<DecisionImpact, ''>[] = ['scope', 'schedule', 'cost', 'quality', 'other'];

export const IMPACT_LABEL: Record<Exclude<DecisionImpact, ''>, string> = {
  scope: 'Scope',
  schedule: 'Schedule',
  cost: 'Cost',
  quality: 'Quality',
  other: 'Other',
};

export function decisionStatusLabel(s: string): string {
  return DECISION_STATUS_LABEL[s as DecisionStatus] ?? s;
}

/** Where one approver stands on a decision. */
export function approverState(d: Pick<Decision, 'approvals'>, userId: string): 'approved' | 'rejected' | 'waiting' {
  const a = (d.approvals ?? []).find((x) => x.user_id === userId);
  if (!a) return 'waiting';
  return a.decision === 'reject' ? 'rejected' : 'approved';
}

/** What the caller may do with a decision. */
export function decisionActions(d: Pick<Decision, 'status' | 'approver_ids' | 'approvals'>, me: string, canManage: boolean) {
  const proposed = d.status === 'proposed';
  const named = !!me && (d.approver_ids ?? []).includes(me);
  return {
    answer: proposed && named && approverState(d, me) === 'waiting',
    edit: proposed && canManage,
    delete: proposed && canManage,
    supersede: d.status === 'approved' && canManage,
  };
}

/** Why a verdict cannot be sent, or null: a rejection needs a comment. */
export function verdictError(verdict: 'approve' | 'reject', comment: string): string | null {
  if (verdict === 'reject' && !comment.trim()) return 'Say why you reject it.';
  if ([...comment.trim()].length > 2000) return 'The comment is at most 2000 characters.';
  return null;
}

/** Why a decision cannot be logged, or null. */
export function decisionFormError(f: { title: string; approver_ids: readonly string[] }): string | null {
  if (!f.title.trim()) return 'Give the decision a title.';
  if ([...f.title.trim()].length > MAX_NAME_CHARS) return `A title is at most ${MAX_NAME_CHARS} characters.`;
  if (f.approver_ids.length > MAX_APPROVERS) return `A decision has at most ${MAX_APPROVERS} approvers.`;
  return null;
}

/** The decision's reference, D-007 style. */
export function decisionRef(n: number): string {
  return `D-${String(n).padStart(3, '0')}`;
}

/** A refused governance write in plain words. */
export function governanceErrorText(code: string | undefined, apiText: string | undefined, fallback: string): string {
  switch (code) {
    case 'decision_closed':
      return 'This decision is no longer waiting for approval, so it cannot change.';
    case 'already_answered':
      return 'You have already answered this decision.';
    case 'not_approver':
      return 'Only the people named as approvers can answer this decision.';
    default: {
      const t = (apiText ?? '').trim();
      if (!t) return fallback;
      const cap = t.charAt(0).toUpperCase() + t.slice(1);
      return /[.!?]$/.test(cap) ? cap : `${cap}.`;
    }
  }
}
