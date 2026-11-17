// Pure helpers for the client portal and the team's client screens (sprint 14). No React, no
// aliases and no runtime imports, so node-tests can load this file directly.

/** The persisted portal session key. The staff app keeps its own (projects-auth-storage). */
export const PORTAL_AUTH_STORAGE_KEY = 'projects-portal-auth-storage';
/** sessionStorage prefix for the portal's PKCE verifier, state and return path. */
export const PORTAL_PKCE_NS = 'portal_';

/** /{org}/portal and everything under it. */
export function portalBase(orgSlug: string): string {
  return `/${orgSlug}/portal`;
}

/** Whether pathname is a portal page of orgSlug (the staff shell and staff sign-in stay out). */
export function isPortalPath(pathname: string | null | undefined, orgSlug: string): boolean {
  if (!pathname || !orgSlug) return false;
  const base = portalBase(orgSlug);
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** The callback auth-api's projects-portal client is registered with, on this origin. */
export function portalCallbackUrl(origin: string, orgSlug: string): string {
  return `${origin}${portalBase(orgSlug)}/auth/callback`;
}

/**
 * Where to land after sign-in: the saved path when it is a portal page of this firm, else the
 * portal home. A saved staff page or another site is never followed.
 */
export function safePortalReturn(saved: string | null | undefined, orgSlug: string, origin: string): string {
  const home = portalBase(orgSlug);
  if (!saved) return home;
  try {
    const url = new URL(saved, origin);
    if (url.origin !== origin) return home;
    if (!isPortalPath(url.pathname, orgSlug) || url.pathname.startsWith(`${home}/auth`)) return home;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return home;
  }
}

/** True when GET /portal/projects says invites wait for a verified email (X-Client-Invites). */
export function invitesNeedVerification(headers: Record<string, string | undefined> | null | undefined): boolean {
  if (!headers) return false;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'x-client-invites') return (v ?? '').trim().toLowerCase() === 'email_not_verified';
  }
  return false;
}

/** auth-ui's profile page on its email tab, where an address is verified. */
export function verifyEmailUrl(accountsBase: string): string {
  return `${accountsBase.replace(/\/+$/, '')}/dashboard/profile?tab=email`;
}

// Milestone review.

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'ready_for_review'
  | 'approved'
  | 'changes_requested';

const MILESTONE_LABELS: Record<string, string> = {
  pending: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  missed: 'Missed',
  ready_for_review: 'Ready for your review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
};

/** A milestone status in the client's words. */
export function milestoneLabel(status: string): string {
  return MILESTONE_LABELS[status] ?? status.replace(/_/g, ' ');
}

/** The same status in the team's words: "ready for your review" reads wrong to staff. */
export function teamMilestoneLabel(status: string): string {
  if (status === 'ready_for_review') return 'Waiting for client review';
  return milestoneLabel(status);
}

/**
 * Whether the team may put a milestone up for review: not while it waits for one, and not once the
 * client approved it or it is complete. A milestone sent back with changes can go up again.
 */
export function canMarkReady(status: string): boolean {
  return status !== 'ready_for_review' && status !== 'approved' && status !== 'completed';
}

export type Decision = 'approve' | 'request_changes';

/** projects-api's bound on a decision comment. */
export const MAX_DECISION_COMMENT = 2000;

/** Why a decision cannot be sent yet, or null when it can. Mirrors the API's checks. */
export function decisionProblem(decision: Decision, comment: string): string | null {
  const text = comment.trim();
  if (decision === 'request_changes' && !text) return 'Say what needs to change so the team can act on it.';
  if ([...text].length > MAX_DECISION_COMMENT) return `Keep the comment under ${MAX_DECISION_COMMENT} characters.`;
  return null;
}

// Refusals.

export type PortalRefusal = 'not_client' | 'no_feature' | 'not_ready' | 'not_found' | null;

/** What a portal answer's status and code mean for the screen. */
export function portalRefusal(status: number | undefined, code: string | undefined): PortalRefusal {
  if (status === 409 && code === 'milestone_not_ready') return 'not_ready';
  if (status === 403 && (code === 'feature_not_available' || code === 'subscription_inactive')) return 'no_feature';
  if (status === 403) return 'not_client';
  if (status === 404) return 'not_found';
  return null;
}

/** The invite answer as a sentence for the toast. */
export function inviteOutcome(name: string, resent: boolean): string {
  const who = name.trim() || 'The client';
  return resent ? `${who} was already invited, so the invite went out again.` : `${who} is invited. They get an email and a WhatsApp message.`;
}

/** A client row's state in plain words. */
export function clientStatusLabel(status: string): string {
  if (status === 'active') return 'Signed in';
  if (status === 'invited') return 'Invited';
  return status;
}

/** A client's last decision as one line: "Approved by Jane Client", "Changes requested". */
export function decisionSummary(d: { decision: string; decided_by_name?: string | null }): string {
  const what = d.decision === 'approved' ? 'Approved' : 'Changes requested';
  const who = (d.decided_by_name ?? '').trim();
  return who ? `${what} by ${who}` : what;
}

/**
 * The landing card's note from its progress counts: milestones waiting for the client first, then
 * milestones done, then tasks done, else nothing.
 */
export function landingNote(p: {
  awaiting_review: number;
  milestones_total: number;
  milestones_done: number;
  tasks_total: number;
  tasks_done: number;
} | null | undefined): string {
  if (!p) return '';
  if (p.awaiting_review > 0) return `${p.awaiting_review} milestone${p.awaiting_review === 1 ? '' : 's'} waiting for you`;
  if (p.milestones_total > 0) return `${p.milestones_done} of ${p.milestones_total} milestone${p.milestones_total === 1 ? '' : 's'} done`;
  if (p.tasks_total > 0) return `${p.tasks_done} of ${p.tasks_total} task${p.tasks_total === 1 ? '' : 's'} done`;
  return '';
}

/**
 * Who wrote a client thread entry, for the reader meId: "You" for their own entries, else the name
 * (or a neutral fallback), with a Client or Team tag from author_kind.
 */
export function threadAuthor(
  entry: { author_id: string; author_name?: string | null; author_kind?: string | null },
  meId?: string | null,
): { name: string; tag: 'Client' | 'Team'; mine: boolean } {
  const client = entry.author_kind === 'client';
  const mine = !!meId && entry.author_id === meId;
  const name = mine ? 'You' : (entry.author_name ?? '').trim() || (client ? 'A client' : 'Someone from the team');
  return { name, tag: client ? 'Client' : 'Team', mine };
}

/** Whole percent between 0 and 100. */
export function clampPercent(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** True when a task or attachment's metadata shares it with the project's clients. */
export function isClientVisible(meta: Record<string, unknown> | null | undefined): boolean {
  return meta?.client_visible === true;
}
