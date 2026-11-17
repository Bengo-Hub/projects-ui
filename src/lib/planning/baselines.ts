// Baselines and slips (sprint 16). No React, no aliases and no runtime imports, so node-tests can
// load this file directly.

/** "5 days late", "2 days early", "On time". */
export function slipText(days: number): string {
  if (!days) return 'On time';
  const n = Math.abs(days);
  return `${n} ${n === 1 ? 'day' : 'days'} ${days > 0 ? 'late' : 'early'}`;
}

/** Theme classes for a slip: late is destructive, early is success. */
export function slipClass(days: number): string {
  if (days > 0) return 'text-destructive';
  if (days < 0) return 'text-success';
  return 'text-muted-foreground';
}

export interface SlipLike {
  finish_slip_days: number;
  baseline_finish: string | null;
  current_finish: string | null;
}

/** What happened to an item's finish: moved by days, gained a date, or lost it. */
export function finishChange(s: SlipLike): string {
  if (!s.baseline_finish && s.current_finish) return 'Gained a due date';
  if (s.baseline_finish && !s.current_finish) return 'Lost its due date';
  return slipText(s.finish_slip_days);
}

/** Biggest slip first, then pulled-in items, the API's order kept among equals. */
export function sortSlips<T extends SlipLike>(slips: T[]): T[] {
  return slips
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.finish_slip_days - a.s.finish_slip_days || a.i - b.i)
    .map((x) => x.s);
}

export interface SlipCounts {
  tasks_compared: number;
  slipped: number;
  pulled_in: number;
  max_slip_days: number;
  removed_since: number;
  added_since: number;
  milestones_slipped: number;
}

/** One sentence on the slips report. */
export function slipSummary(c: SlipCounts): string {
  if (c.slipped === 0 && c.pulled_in === 0) return `All ${c.tasks_compared} tasks are on their baseline dates.`;
  const parts = [`${c.slipped} of ${c.tasks_compared} ${c.tasks_compared === 1 ? 'task' : 'tasks'} slipped`];
  if (c.max_slip_days > 0) parts.push(`the worst by ${c.max_slip_days} ${c.max_slip_days === 1 ? 'day' : 'days'}`);
  if (c.pulled_in > 0) parts.push(`${c.pulled_in} pulled in`);
  return `${parts.join(', ')}.`;
}

/** The default name the API gives when none is sent, shown as the placeholder. */
export function defaultBaselineName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Baseline ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
