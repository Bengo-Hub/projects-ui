// Status report rules the screens share (sprint 7). No React, no aliases and no runtime imports, so
// node-tests can load this file directly. projects-api checks every rule again; these only keep the
// screens from offering what it would refuse.

import type { Rag, ReportMilestone, ReportRisk, StatusReport } from '@/types/reports';

export const RAG_VALUES = ['green', 'amber', 'red'] as const;
export type RagValue = (typeof RAG_VALUES)[number];

export const RAG_LABEL: Record<RagValue, string> = { green: 'Green', amber: 'Amber', red: 'Red' };

/** Chip colours: the rating in words is always beside the colour. */
export const RAG_CLASS: Record<RagValue | 'none', string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
  none: 'border border-border text-muted-foreground',
};

/** The four ratings of a report, in the order the editor and the reading view show them. */
export const RAG_DIMENSIONS = [
  { key: 'rag_overall', suggestion: 'overall', label: 'Overall' },
  { key: 'rag_schedule', suggestion: 'schedule', label: 'Schedule' },
  { key: 'rag_cost', suggestion: 'cost', label: 'Cost' },
  { key: 'rag_scope', suggestion: 'scope', label: 'Scope' },
] as const;
export type RagKey = (typeof RAG_DIMENSIONS)[number]['key'];

export const MAX_HIGHLIGHTS = 20;
export const MAX_HIGHLIGHT_CHARS = 300;
export const MAX_REPORT_RISKS = 20;
export const MAX_REPORT_MILESTONES = 30;
/** One report covers at most this many days (projects-api MaxPeriodDays). */
export const MAX_PERIOD_DAYS = 100;

/** A known rating or "" for anything else (an older or unrated value). */
export function ragOf(v: string | null | undefined): Rag {
  return v === 'green' || v === 'amber' || v === 'red' ? v : '';
}

/** Orders ratings best to worst; not rated ranks below green, as the API's RAGRank. */
export function ragRank(v: string | null | undefined): number {
  const r = ragOf(v);
  return r === 'green' ? 1 : r === 'amber' ? 2 : r === 'red' ? 3 : 0;
}

/** The worst of the ratings, "" when none is rated. */
export function worstRag(...ratings: (string | null | undefined)[]): Rag {
  let out: Rag = '';
  for (const r of ratings) if (ragRank(r) > ragRank(out)) out = ragOf(r);
  return out;
}

export function ragLabel(v: string | null | undefined): string {
  const r = ragOf(v);
  return r ? RAG_LABEL[r] : 'Not rated';
}

export function ragClass(v: string | null | undefined): string {
  const r = ragOf(v);
  return RAG_CLASS[r || 'none'];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A local date as YYYY-MM-DD. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The date part of an API date or time ("2026-11-09T00:00:00Z" or "2026-11-09"). */
export function dayOnly(s: string | null | undefined): string {
  return s ? s.slice(0, 10) : '';
}

/**
 * The last full week, Monday to Sunday, before now: the API's own default period. On a Sunday the
 * week is not over yet, so it is the week before.
 */
export function lastFullWeek(now: Date): { start: string; end: string } {
  const wd = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (wd - 1));
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7);
  const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1);
  return { start: ymd(start), end: ymd(end) };
}

function utcDays(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Why a period cannot be reported on, or null. */
export function periodError(start: string, end: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 'Pick the first and last day of the period.';
  const span = utcDays(end) - utcDays(start);
  if (span < 0) return 'The last day must be on or after the first day.';
  if (span > MAX_PERIOD_DAYS) return `A report covers at most ${MAX_PERIOD_DAYS} days.`;
  return null;
}

/** The highlights as they are saved: trimmed, empty lines dropped. */
export function cleanHighlights(list: readonly string[]): string[] {
  return list.map((h) => h.trim()).filter(Boolean);
}

/** Why the highlights cannot be saved, or null. */
export function highlightsError(list: readonly string[]): string | null {
  const clean = cleanHighlights(list);
  if (clean.length > MAX_HIGHLIGHTS) return `A report has at most ${MAX_HIGHLIGHTS} highlights.`;
  if (clean.some((h) => [...h].length > MAX_HIGHLIGHT_CHARS)) return `A highlight is at most ${MAX_HIGHLIGHT_CHARS} characters.`;
  return null;
}

/** Why a draft cannot be published yet, or null (the API answers 422 for the same). */
export function publishProblem(r: { rag_overall?: string | null }): string | null {
  return ragOf(r.rag_overall) ? null : 'Set the overall rating before publishing.';
}

/** The editable part of a draft. */
export interface ReportDraft {
  title: string;
  rag_overall: Rag;
  rag_schedule: Rag;
  rag_cost: Rag;
  rag_scope: Rag;
  narrative: string;
  highlights: string[];
  risks: ReportRisk[];
  milestones: ReportMilestone[];
}

export function draftOf(r: StatusReport): ReportDraft {
  return {
    title: r.title ?? '',
    rag_overall: ragOf(r.rag_overall),
    rag_schedule: ragOf(r.rag_schedule),
    rag_cost: ragOf(r.rag_cost),
    rag_scope: ragOf(r.rag_scope),
    narrative: r.narrative ?? '',
    highlights: [...(r.highlights ?? [])],
    risks: [...(r.risks ?? [])],
    milestones: [...(r.milestones ?? [])],
  };
}

/**
 * What changed between the saved draft and the edited one, for PUT. A list that changed goes whole,
 * as the API replaces it; highlights go trimmed.
 */
export function draftPatch(saved: ReportDraft, edited: ReportDraft): Partial<ReportDraft> {
  const out: Partial<ReportDraft> = {};
  const title = edited.title.trim();
  if (title !== saved.title.trim()) out.title = title;
  for (const k of ['rag_overall', 'rag_schedule', 'rag_cost', 'rag_scope'] as const) {
    if (edited[k] !== saved[k]) out[k] = edited[k];
  }
  if (edited.narrative !== saved.narrative) out.narrative = edited.narrative;
  const highlights = cleanHighlights(edited.highlights);
  if (JSON.stringify(highlights) !== JSON.stringify(cleanHighlights(saved.highlights))) out.highlights = highlights;
  if (JSON.stringify(edited.risks) !== JSON.stringify(saved.risks)) out.risks = edited.risks;
  if (JSON.stringify(edited.milestones) !== JSON.stringify(saved.milestones)) out.milestones = edited.milestones;
  return out;
}

/** Why the draft cannot be saved, or null. */
export function draftError(d: ReportDraft): string | null {
  if (!d.title.trim()) return 'Give the report a title.';
  return highlightsError(d.highlights);
}

/** What the caller may do with a report. Hiding a button is for clarity: the API checks each call. */
export interface ReportAccess {
  canManage: boolean;
  canPortalManage: boolean;
  canFinancials: boolean;
  /** budget_tracking on the plan. */
  budgetTracking: boolean;
  /** client_portal on the plan. */
  clientPortal: boolean;
}

export function reportActions(r: Pick<StatusReport, 'status' | 'client_visible'>, a: ReportAccess) {
  const draft = r.status === 'draft';
  const share = !draft && a.canManage && a.canPortalManage && a.clientPortal;
  return {
    edit: draft && a.canManage,
    refresh: draft && a.canManage,
    publish: draft && a.canManage,
    delete: draft && a.canManage,
    share,
    unshare: share && r.client_visible,
    /** The share dialog offers financials only to someone who may see them. */
    includeFinancials: share && financialsVisible(a),
  };
}

/** Whether the money section can show for this reader. */
export function financialsVisible(a: Pick<ReportAccess, 'canFinancials' | 'budgetTracking'>): boolean {
  return a.canFinancials && a.budgetTracking;
}

/** How the financial section reads: shown, hidden for this role, or absent. */
export function financialState(r: { financials?: unknown; financials_hidden?: boolean }): 'shown' | 'hidden' | 'none' {
  if (r.financials) return 'shown';
  return r.financials_hidden ? 'hidden' : 'none';
}

/** A refused write in plain words, from the API's code. */
export function reportErrorText(code: string | undefined, apiText: string | undefined, fallback: string): string {
  switch (code) {
    case 'report_exists':
      return 'There is already a report for this period. Open it from the history.';
    case 'report_published':
      return 'This report is published and can no longer change.';
    case 'report_not_published':
      return 'Publish the report before sharing it with the client.';
    case 'admin_required':
      return 'Only an administrator can change this setting.';
    default:
      return apiText ? sentence(apiText) : fallback;
  }
}

/** The API's lower-case message as a sentence ("set the overall rating" to "Set the overall rating."). */
export function sentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
}

/** The portal link the share notice uses, so the team can copy the same one. */
export function portalReportPath(orgSlug: string, projectId: string, reportId: string): string {
  return `/${orgSlug}/portal/projects/${projectId}?tab=reports&report=${reportId}`;
}

/** A schedule or cost index as two decimals, or a dash when there is none. */
export function indexText(v: number | null | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '-';
}

/** A percent from the API (0 to 100) rounded for a tile. */
export function percentText(v: number | null | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}%` : '-';
}

/** The file name a downloaded report gets. */
export function reportFileName(r: { title?: string }): string {
  const base = (r.title ?? 'status-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'status-report'}.pdf`;
}
