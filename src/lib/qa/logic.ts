// Pure helpers for the QA and acceptance screens. No React, no aliases and no runtime imports, so
// node-tests can load this file directly with node --experimental-strip-types.
import type {
  QACriterionInput,
  QACriterionSubject,
  QADefect,
  QAOutcome,
  QAResult,
  QAResultValue,
  QARole,
  QASessionStatus,
  QAVerdictInput,
  QAWeight,
} from '../../types/qa';

// Permissions, in the same shape as projects-api's qaAllowed (internal/http/handlers/qa_perms.go):
// manage includes run and view, run includes view; tenant admins and the platform owner pass.
export const QA_PERMISSIONS = {
  view: 'projects.qa.view',
  run: 'projects.qa.run',
  manage: 'projects.qa.manage',
} as const;

export type QAAccessLevel = keyof typeof QA_PERMISSIONS;

export interface QAUserLike {
  permissions?: string[];
  roles?: string[];
  isPlatformOwner?: boolean;
}

const ADMIN_ROLES = ['admin', 'super_admin', 'superuser'];

export function qaAllowed(user: QAUserLike | null | undefined, need: QAAccessLevel): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  const roles = user.roles ?? [];
  if (user.isPlatformOwner || roles.some((r) => ADMIN_ROLES.includes(r))) return true;
  if (perms.includes(QA_PERMISSIONS.manage)) return true;
  if (need === 'view' && perms.includes(QA_PERMISSIONS.run)) return true;
  return perms.includes(QA_PERMISSIONS[need]);
}

// Labels in plain language.

export const RESULT_LABELS: Record<QAResultValue, string> = {
  pass: 'Pass',
  fail: 'Fail',
  blocked: 'Blocked',
  not_run: 'Skip (not run)',
};

export const RESULT_ORDER: QAResultValue[] = ['pass', 'fail', 'blocked', 'not_run'];

export const SEVERITY_LABELS: Record<number, string> = {
  1: '1 Critical',
  2: '2 Major',
  3: '3 Minor',
  4: '4 Cosmetic',
};

export const WEIGHT_LABELS: Record<QAWeight, string> = {
  must: 'Must',
  should: 'Should',
  could: 'Could',
};

export const SUBJECT_LABELS: Record<QACriterionSubject, string> = {
  feature: 'Feature',
  milestone: 'Milestone',
  task: 'Task',
  none: 'None',
};

export const ROLE_LABELS: Record<QARole, string> = {
  tester: 'Tester',
  signer: 'Signer',
  observer: 'Observer',
};

export const ROLE_HELP: Record<QARole, string> = {
  tester: 'Records a verdict on each criterion',
  signer: 'Reviews the outcome and signs the report',
  observer: 'Reads the outcome only',
};

const SUBJECTS: QACriterionSubject[] = ['feature', 'milestone', 'task', 'none'];
const WEIGHTS: QAWeight[] = ['must', 'should', 'could'];
const RESULTS: QAResultValue[] = ['pass', 'fail', 'blocked', 'not_run'];

export function isResult(v: unknown): v is QAResultValue {
  return typeof v === 'string' && (RESULTS as string[]).includes(v);
}

// Verdicts.

/** The reason a verdict cannot be sent yet, or null when it can. Mirrors RecordResult's checks. */
export function verdictProblem(v: QAVerdictInput): string | null {
  if (!isResult(v.result)) return 'Choose a verdict.';
  if (v.result === 'fail') {
    const s = v.severity;
    if (s == null || !Number.isInteger(s) || s < 1 || s > 4) return 'A failure needs a severity.';
  }
  if ((v.notes ?? '').trim().length > 5000) return 'Notes are limited to 5000 characters.';
  if ((v.device ?? '').trim().length > 200) return 'Device is limited to 200 characters.';
  return null;
}

/** The body to send: severity only on a failure, text trimmed. */
export function normalizeVerdict(v: QAVerdictInput): QAVerdictInput {
  return {
    result: v.result,
    severity: v.result === 'fail' ? v.severity ?? null : null,
    notes: (v.notes ?? '').trim(),
    device: (v.device ?? '').trim(),
  };
}

export function sameVerdict(a: QAVerdictInput | undefined, b: QAVerdictInput | undefined): boolean {
  if (!a || !b) return a === b;
  const x = normalizeVerdict(a);
  const y = normalizeVerdict(b);
  return x.result === y.result && (x.severity ?? null) === (y.severity ?? null) && x.notes === y.notes;
}

export function verdictFromResult(r: QAResult): QAVerdictInput {
  return { result: r.result, severity: r.severity ?? null, notes: r.notes ?? '', device: r.device ?? '' };
}

/** A short device description for the result record, from a user agent string. */
export function describeDevice(userAgent: string): string {
  const ua = userAgent || '';
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Unknown system';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'browser';
  const kind = /Mobi|Android|iPhone/i.test(ua) ? 'phone' : 'computer';
  return `${os} ${kind}, ${browser}`.slice(0, 200);
}

// Offline-safe drafts. A draft is a verdict typed on this device that the API has not accepted yet.

export type QADrafts = Record<string, QAVerdictInput>;

export function draftStorageKey(sessionId: string, who: string): string {
  return `qa-drafts:${sessionId}:${who}`;
}

export function parseDrafts(raw: string | null): QADrafts {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: QADrafts = {};
    for (const [k, d] of Object.entries(v as Record<string, unknown>)) {
      const dv = d as Partial<QAVerdictInput> | null;
      if (dv && isResult(dv.result)) {
        out[k] = {
          result: dv.result,
          severity: typeof dv.severity === 'number' ? dv.severity : null,
          notes: typeof dv.notes === 'string' ? dv.notes : '',
          device: typeof dv.device === 'string' ? dv.device : '',
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** The verdict to show per criterion: a pending draft wins over the saved result. */
export function mergeVerdicts(saved: QAResult[] | null | undefined, drafts: QADrafts): Record<string, QAVerdictInput> {
  const out: Record<string, QAVerdictInput> = {};
  for (const r of saved ?? []) out[r.criterion_id] = verdictFromResult(r);
  for (const [k, d] of Object.entries(drafts)) out[k] = d;
  return out;
}

/** Drafts the server already holds are dropped, so a reload does not resend them. */
export function pruneDrafts(saved: QAResult[] | null | undefined, drafts: QADrafts): QADrafts {
  const byId = new Map((saved ?? []).map((r) => [r.criterion_id, verdictFromResult(r)]));
  const out: QADrafts = {};
  for (const [k, d] of Object.entries(drafts)) {
    if (!sameVerdict(byId.get(k), d)) out[k] = d;
  }
  return out;
}

// Session decisions.

/** Why the session cannot be accepted, or null when it can. */
export function acceptBlockedReason(status: QASessionStatus | undefined, outcome: QAOutcome | undefined): string | null {
  if (status !== 'closed') return 'Close the session before deciding.';
  if (!outcome) return 'The outcome is still loading.';
  if (outcome.accepted) return null;
  const reasons = outcome.reasons?.length ? outcome.reasons.join('; ') : 'the pass rule is not met';
  return `The pass rule is not met: ${reasons}.`;
}

/** Current results grouped by criterion id. */
export function groupByCriterion(results: QAResult[] | null | undefined): Map<string, QAResult[]> {
  const m = new Map<string, QAResult[]>();
  for (const r of results ?? []) {
    const list = m.get(r.criterion_id) ?? [];
    list.push(r);
    m.set(r.criterion_id, list);
  }
  return m;
}

/** Whether a failing criterion can have its ticket raised or retried by hand. */
export function canRaiseTicket(status: QAResultValue, defect: QADefect | undefined): boolean {
  if (status !== 'fail') return false;
  return !defect || defect.status !== 'ticketed';
}

export function shareLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/qa/${encodeURIComponent(code)}`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Bulk import of criteria: a JSON array (or {"criteria": [...]}) or CSV with a header row.

export const IMPORT_COLUMNS = [
  'area_code',
  'title',
  'subject_kind',
  'subject_ref',
  'weight',
  'requirement_ref',
  'preconditions',
  'steps',
  'expected_result',
  'automated_ref',
] as const;

export const MAX_CRITERIA_PER_CALL = 500;

const LIMITS: Record<string, number> = {
  title: 300,
  subject_ref: 200,
  area_code: 32,
  requirement_ref: 100,
  automated_ref: 300,
  preconditions: 10000,
  steps: 10000,
  expected_result: 10000,
};

/** RFC 4180 style CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export interface ImportResult {
  criteria: QACriterionInput[];
  errors: string[];
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Checks one row the way projects-api does, so mistakes show before anything is sent. */
export function toCriterionInput(raw: Record<string, unknown>, line: number, platform: boolean): { value?: QACriterionInput; error?: string } {
  const subject = (str(raw.subject_kind).toLowerCase() || 'none') as QACriterionSubject;
  const weight = (str(raw.weight).toLowerCase() || 'must') as QAWeight;
  const v: QACriterionInput = {
    subject_kind: subject,
    subject_ref: str(raw.subject_ref),
    area_code: str(raw.area_code),
    title: str(raw.title),
    requirement_ref: str(raw.requirement_ref),
    preconditions: str(raw.preconditions),
    steps: str(raw.steps),
    expected_result: str(raw.expected_result),
    weight,
    automated_ref: str(raw.automated_ref),
  };
  if (!v.title) return { error: `Row ${line}: a title is required.` };
  if (!SUBJECTS.includes(subject)) return { error: `Row ${line}: subject kind must be feature, milestone, task or none.` };
  if (!WEIGHTS.includes(weight)) return { error: `Row ${line}: weight must be must, should or could.` };
  if (subject === 'feature' && !v.subject_ref) return { error: `Row ${line}: a feature criterion needs the feature code.` };
  if ((subject === 'milestone' || subject === 'task') && platform) {
    return { error: `Row ${line}: a platform template can only check features or free criteria.` };
  }
  if ((subject === 'milestone' || subject === 'task') && !v.subject_ref) {
    return { error: `Row ${line}: a ${subject} criterion needs the ${subject} id.` };
  }
  for (const [k, max] of Object.entries(LIMITS)) {
    const val = (v as unknown as Record<string, string | undefined>)[k] ?? '';
    if (val.length > max) return { error: `Row ${line}: ${k} is longer than ${max} characters.` };
  }
  if (subject === 'none') v.subject_ref = '';
  return { value: v };
}

export function parseCriteriaImport(text: string, platform = false): ImportResult {
  const src = text.trim();
  const out: ImportResult = { criteria: [], errors: [] };
  if (!src) {
    out.errors.push('Paste or choose a file first.');
    return out;
  }
  let rows: Record<string, unknown>[] = [];
  if (src.startsWith('[') || src.startsWith('{')) {
    try {
      const parsed = JSON.parse(src) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { criteria?: unknown }).criteria)
          ? (parsed as { criteria: unknown[] }).criteria
          : null;
      if (!list) {
        out.errors.push('The JSON must be a list of criteria, or an object with a "criteria" list.');
        return out;
      }
      rows = list.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
    } catch {
      out.errors.push('The JSON could not be read.');
      return out;
    }
  } else {
    const table = parseCsv(src);
    if (table.length < 2) {
      out.errors.push('The CSV needs a header row and at least one criterion.');
      return out;
    }
    const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    if (!header.includes('title')) {
      out.errors.push('The CSV header needs a "title" column.');
      return out;
    }
    rows = table.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])));
  }
  rows.forEach((r, i) => {
    const { value, error } = toCriterionInput(r, i + 1, platform);
    if (error) out.errors.push(error);
    else if (value) out.criteria.push(value);
  });
  if (!out.criteria.length && !out.errors.length) out.errors.push('No criteria were found.');
  return out;
}
