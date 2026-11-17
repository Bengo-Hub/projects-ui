// Risk register rules the screens share (sprint 16). No React, no aliases and no runtime imports,
// so node-tests can load this file directly.

export const RISK_STATUSES = ['open', 'monitoring', 'mitigated', 'occurred', 'closed'] as const;
export type RiskStatusCode = (typeof RISK_STATUSES)[number];

export const RISK_STATUS_LABEL: Record<RiskStatusCode, string> = {
  open: 'Open',
  monitoring: 'Monitoring',
  mitigated: 'Mitigated',
  occurred: 'Occurred',
  closed: 'Closed',
};

export const LIKELIHOOD_LABEL = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
export const IMPACT_LABEL = ['Minor', 'Moderate', 'Serious', 'Major', 'Severe'];

export type ScoreBand = 'low' | 'medium' | 'high' | 'critical';

/** Score is likelihood times impact, as the API stores it. */
export function riskScore(likelihood: number, impact: number): number {
  return likelihood * impact;
}

/** The band of a score from 1 to 25. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 15) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export const SCORE_CLASS: Record<ScoreBand, string> = {
  low: 'bg-success/15 text-success',
  medium: 'bg-warning/15 text-warning',
  high: 'bg-warning/30 text-foreground',
  critical: 'bg-destructive/20 text-destructive',
};

export const SCORE_LABEL: Record<ScoreBand, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

export interface HeatCellView {
  likelihood: number;
  impact: number;
  count: number;
  score: number;
  band: ScoreBand;
}

/**
 * The 5x5 grid as drawn: likelihood rows from 5 at the top to 1 at the bottom, impact columns from
 * 1 to 5. The API's grid is indexed [likelihood-1][impact-1]; a short or missing row reads as zeros.
 */
export function heatRows(grid: number[][] | undefined | null): HeatCellView[][] {
  const rows: HeatCellView[][] = [];
  for (let l = 5; l >= 1; l--) {
    const row: HeatCellView[] = [];
    for (let i = 1; i <= 5; i++) {
      const count = Number(grid?.[l - 1]?.[i - 1] ?? 0) || 0;
      const score = riskScore(l, i);
      row.push({ likelihood: l, impact: i, count, score, band: scoreBand(score) });
    }
    rows.push(row);
  }
  return rows;
}

export interface CellFilter {
  likelihood: number;
  impact: number;
}

/** A heat map cell click toggles the filter: the same cell again clears it. */
export function toggleCell(current: CellFilter | null, next: CellFilter): CellFilter | null {
  if (current && current.likelihood === next.likelihood && current.impact === next.impact) return null;
  return next;
}

/** Whether a risk falls in the picked cell (no cell keeps every risk). */
export function inCell(r: { likelihood: number; impact: number }, cell: CellFilter | null): boolean {
  return !cell || (r.likelihood === cell.likelihood && r.impact === cell.impact);
}

export interface RiskForm {
  title: string;
  likelihood: number;
  impact: number;
  due_date: string;
}

/** The first problem with a risk form, or null when the API would take it. */
export function riskFormError(f: RiskForm): string | null {
  if (!f.title.trim()) return 'Give the risk a title.';
  if (!(f.likelihood >= 1 && f.likelihood <= 5) || !Number.isInteger(f.likelihood)) return 'Likelihood runs from 1 to 5.';
  if (!(f.impact >= 1 && f.impact <= 5) || !Number.isInteger(f.impact)) return 'Impact runs from 1 to 5.';
  if (f.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(f.due_date)) return 'Pick a real due date.';
  return null;
}

/**
 * The patch for an edit: only the fields that changed; a cleared owner or due date goes as "", which
 * the API reads as a clear.
 */
export function riskPatch<T extends Record<string, unknown>>(before: T, after: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(after) as (keyof T)[]) {
    const a = after[k] ?? '';
    const b = before[k] ?? '';
    if (a !== b) out[k] = a as T[keyof T];
  }
  return out;
}
