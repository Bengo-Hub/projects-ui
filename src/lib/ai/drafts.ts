// AI assistant rules the screens share (sprint 10). Every AI answer is a draft: these helpers turn
// the drafts a person ticked into the ordinary create and update bodies, and explain an AI refusal.
// No React, no aliases and no runtime imports, so node-tests can load this file directly.

export interface Credits {
  charged: number;
  exempt: boolean;
  replayed: boolean;
}

export interface Review {
  review_notes: string[];
  tainted: boolean;
  stopped_early: boolean;
}

export interface DraftTask {
  title: string;
  description: string;
  priority: string;
  estimated_hours: number | null;
}

export interface DraftRisk {
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  mitigation: string;
}

export interface Estimate {
  task_id: string;
  title: string;
  current_hours: number | null;
  estimated_hours: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}

export type Health = 'on_track' | 'at_risk' | 'off_track';

export const HEALTH_LABEL: Record<Health, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
};

export const HEALTH_CLASS: Record<Health, string> = {
  on_track: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  at_risk: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  off_track: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

/** The AI error codes projects-api answers with. */
export type AIErrorCode = 'ai_credits_exhausted' | 'ai_credits_unknown' | 'ai_unavailable' | 'validation_error' | 'not_found';

export interface AIErrorInfo {
  /** What the person reads. */
  message: string;
  /** Whether a top up would fix it (show the billing link). */
  topUp: boolean;
  /** Whether trying again later may work. */
  retry: boolean;
}

/**
 * Explains an AI refusal from the API body. A refusal for credits points at a top up; a provider
 * failure says nothing was charged, because projects-api spends credits only on a usable answer.
 */
export function aiErrorInfo(status: number | undefined, body: { code?: string; error?: string; reason?: string } | undefined): AIErrorInfo {
  switch (body?.code) {
    case 'ai_credits_exhausted':
      if (body.reason === 'no_subscription') {
        return { message: 'AI needs an active subscription. Check your plan, then buy AI credits.', topUp: true, retry: false };
      }
      if (body.reason === 'service_not_activated') {
        return { message: 'AI credits are not switched on for your organisation yet. Buy a first bundle of AI credits to start.', topUp: true, retry: false };
      }
      return { message: 'Your organisation has run out of AI credits. Top up AI credits to keep using the assistant.', topUp: true, retry: false };
    case 'ai_credits_unknown':
      return { message: 'AI credits could not be checked just now, so nothing ran. Try again in a moment.', topUp: false, retry: true };
    case 'ai_unavailable':
      return { message: 'The assistant could not answer just now. Nothing was charged. Try again in a moment.', topUp: false, retry: true };
    case 'validation_error':
      return { message: body.error || 'Check what you entered and try again.', topUp: false, retry: false };
    case 'not_found':
      return { message: 'That project or task is not available to you.', topUp: false, retry: false };
  }
  if (status === undefined) {
    return { message: 'The assistant took too long to answer. Try again; the same request will not be charged twice.', topUp: false, retry: true };
  }
  return { message: 'The assistant could not answer just now. Try again in a moment.', topUp: false, retry: true };
}

/** One line on what a draft cost. */
export function creditsLine(c: Credits | undefined): string {
  if (!c) return '';
  if (c.exempt) return 'No AI credits used (your plan covers it).';
  if (c.replayed) return 'Shown again from your last request; no extra credits used.';
  if (c.charged === 1) return '1 AI credit used.';
  return `${c.charged} AI credits used.`;
}

/** A new request key for one ask. A retry of the same ask reuses it, so it is charged once. */
export function newRequestKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `ai-${c.randomUUID()}`;
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Toggles one index in a selection. */
export function toggleIndex(selected: readonly number[], i: number): number[] {
  return selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i].sort((a, b) => a - b);
}

/** Every index of a list (select all). */
export function allIndexes(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export interface TaskCreateBody {
  title: string;
  description?: string;
  priority?: string;
  estimated_hours?: number;
  parent_id?: string;
}

/** The task create bodies for the ticked drafts, in order, with empty titles dropped. */
export function tasksToCreate(drafts: readonly DraftTask[], selected: readonly number[], parentId?: string | null): TaskCreateBody[] {
  const out: TaskCreateBody[] = [];
  for (const i of [...selected].sort((a, b) => a - b)) {
    const d = drafts[i];
    const title = d?.title.trim();
    if (!d || !title) continue;
    const body: TaskCreateBody = { title };
    if (d.description.trim()) body.description = d.description.trim();
    if (d.priority) body.priority = d.priority;
    if (d.estimated_hours !== null && d.estimated_hours > 0) body.estimated_hours = d.estimated_hours;
    if (parentId) body.parent_id = parentId;
    out.push(body);
  }
  return out;
}

export interface RiskCreateBody {
  title: string;
  description?: string;
  category?: string;
  likelihood: number;
  impact: number;
  mitigation?: string;
}

const clamp15 = (n: number) => Math.min(5, Math.max(1, Math.round(n) || 1));

/** The risk create bodies for the ticked drafts, in order. */
export function risksToCreate(drafts: readonly DraftRisk[], selected: readonly number[]): RiskCreateBody[] {
  const out: RiskCreateBody[] = [];
  for (const i of [...selected].sort((a, b) => a - b)) {
    const d = drafts[i];
    const title = d?.title.trim();
    if (!d || !title) continue;
    const body: RiskCreateBody = { title, likelihood: clamp15(d.likelihood), impact: clamp15(d.impact) };
    if (d.description.trim()) body.description = d.description.trim();
    if (d.category.trim()) body.category = d.category.trim();
    if (d.mitigation.trim()) body.mitigation = d.mitigation.trim();
    out.push(body);
  }
  return out;
}

/** Hours as the screens show them: "6 h", "1.5 h", or a dash. */
export function hoursLabel(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return '-';
  return `${Number.isInteger(h) ? h : Math.round(h * 100) / 100} h`;
}

/** Plain text of a status summary draft, for copying into a report or a message. */
export function summaryText(s: { summary: string; accomplishments: string[]; next_steps: string[]; issues: string[] }): string {
  const parts = [s.summary.trim()];
  const list = (title: string, items: string[]) => {
    if (items.length) parts.push(`${title}\n${items.map((i) => `- ${i}`).join('\n')}`);
  };
  list('Done in the period', s.accomplishments);
  list('Next steps', s.next_steps);
  list('Issues', s.issues);
  return parts.filter(Boolean).join('\n\n');
}

/** The ids of up to max tasks that have no estimate yet, for the estimates helper. */
export function tasksNeedingEstimates(tasks: readonly { id: string; estimated_hours?: number | null; status?: string }[], max = 20): string[] {
  return tasks.filter((t) => (t.estimated_hours === null || t.estimated_hours === undefined) && t.status !== 'done').slice(0, max).map((t) => t.id);
}

/** Plain names of the AI features, for the usage page. */
export const FEATURE_LABEL: Record<string, string> = {
  task_breakdown: 'Task drafts',
  status_summary: 'Status summaries',
  risk_suggestions: 'Risk suggestions',
  estimates: 'Effort estimates',
  search: 'Smart search',
};

/** A usage row's outcome in words. */
export function usageOutcome(status: string, reason?: string): string {
  if (status === 'completed') return 'Answered';
  if (status === 'failed') return 'No answer, not charged';
  if (reason === 'credits_unknown') return 'Credits could not be checked';
  return 'Refused: no AI credits';
}
