// Recurring tasks (sprint 16): the repeat rule kept in task metadata.repeat. No React, no aliases
// and no runtime imports, so node-tests can load this file directly.

export type RepeatFreq = 'daily' | 'weekly' | 'monthly';

export interface RepeatRule {
  freq: RepeatFreq;
  /** 1 to 365. */
  interval: number;
  /** YYYY-MM-DD, the last day a copy may be due. */
  until?: string;
}

/** The picker's choices: interval is "every N days, weeks or months". */
export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly' | 'interval';

const FREQS: RepeatFreq[] = ['daily', 'weekly', 'monthly'];

/** The task's rule, or null when it does not repeat or holds something the API would refuse. */
export function readRepeat(metadata: Record<string, unknown> | undefined | null): RepeatRule | null {
  const v = metadata?.repeat as Record<string, unknown> | undefined | null;
  if (!v || typeof v !== 'object') return null;
  const freq = v.freq as RepeatFreq;
  const interval = Number(v.interval ?? 1);
  if (!FREQS.includes(freq) || !Number.isInteger(interval) || interval < 1 || interval > 365) return null;
  const until = typeof v.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.until) ? v.until : undefined;
  return until ? { freq, interval, until } : { freq, interval };
}

/** The picker mode a rule shows as. */
export function modeOf(rule: RepeatRule | null): RepeatMode {
  if (!rule) return 'none';
  return rule.interval === 1 ? rule.freq : 'interval';
}

const UNIT: Record<RepeatFreq, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateText(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "Repeats every week", "Repeats every 2 months until 31 Dec 2026". */
export function repeatText(rule: RepeatRule | null): string {
  if (!rule) return 'Does not repeat';
  const [one, many] = UNIT[rule.freq];
  const every = rule.interval === 1 ? `every ${one}` : `every ${rule.interval} ${many}`;
  return `Repeats ${every}${rule.until ? ` until ${dateText(rule.until)}` : ''}`;
}

/** The first problem with a rule the user built, or null when the API would take it. */
export function repeatError(rule: RepeatRule | null, today?: string): string | null {
  if (!rule) return null;
  if (!FREQS.includes(rule.freq)) return 'Pick daily, weekly or monthly.';
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 365) return 'Repeat every 1 to 365 days, weeks or months.';
  if (rule.until !== undefined && rule.until !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.until)) return 'Pick a real end date.';
    if (today && rule.until < today) return 'The end date is already past.';
  }
  return null;
}

/** The rule a picker state makes; none is null. */
export function ruleFrom(mode: RepeatMode, freq: RepeatFreq, interval: number, until: string): RepeatRule | null {
  if (mode === 'none') return null;
  const f = mode === 'interval' ? freq : mode;
  const n = mode === 'interval' ? interval : 1;
  return until ? { freq: f, interval: n, until } : { freq: f, interval: n };
}

/**
 * The task metadata to send with a new rule. A task update replaces the client metadata (the API
 * keeps its own keys), so the rest is sent back as it is; no rule leaves the key out, which removes it.
 */
export function metadataWithRepeat(metadata: Record<string, unknown> | undefined | null, rule: RepeatRule | null): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(metadata ?? {}) };
  delete next.recurrence;
  if (rule) next.repeat = rule.until ? { freq: rule.freq, interval: rule.interval, until: rule.until } : { freq: rule.freq, interval: rule.interval };
  else delete next.repeat;
  return next;
}

/** Whether two rules say the same thing. */
export function sameRule(a: RepeatRule | null, b: RepeatRule | null): boolean {
  if (!a || !b) return a === b;
  return a.freq === b.freq && a.interval === b.interval && (a.until ?? '') === (b.until ?? '');
}
