// Change requests (sprint 16): labels, form checks and the refusals the API sends. No React, no
// aliases and no runtime imports, so node-tests can load this file directly.

export const KIND_LABEL: Record<string, string> = { scope: 'Scope', cost: 'Cost', schedule: 'Schedule' };

export const CHANGE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const CHANGE_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
  withdrawn: 'bg-muted text-muted-foreground',
};

export const TREASURY_LABEL: Record<string, string> = {
  not_needed: 'No budget change',
  pending: 'Waiting to go to treasury',
  pushing: 'Sending to treasury',
  submitted: 'Submitted for approval in treasury',
  failed: 'Treasury did not take it',
};

export interface ShiftDraft {
  task_id: string;
  shift_days: number;
}

export interface LineDraft {
  category: 'expense' | 'capex' | 'revenue' | 'other';
  name: string;
  planned_amount: string;
}

export interface BudgetDraft {
  name: string;
  fiscal_year: string;
  period_type: 'monthly' | 'quarterly' | 'annual';
  start_date: string;
  end_date: string;
  currency: string;
  lines: LineDraft[];
}

export interface ChangeDraft {
  title: string;
  kind: 'scope' | 'cost' | 'schedule';
  shifts: ShiftDraft[];
  /** 'existing' updates or submits the project's draft budget; 'new' sends budget lines. */
  budgetMode: 'existing' | 'new';
  budgetId: string;
  budget: BudgetDraft;
}

export const MAX_SHIFTS = 200;

/** A planned amount the treasury form takes: above zero, at most two decimal places. */
export function validAmount(v: string): boolean {
  const s = v.trim();
  return /^\d{1,13}(\.\d{1,2})?$/.test(s) && Number(s) > 0;
}

/** The first problem with the budget lines, or null. */
export function budgetError(b: BudgetDraft): string | null {
  if (!b.name.trim()) return 'Name the budget.';
  if (!/^\d{4}$/.test(b.fiscal_year.trim())) return 'Give the fiscal year as four digits, for example 2027.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(b.end_date)) return 'Pick the budget start and end dates.';
  if (b.start_date > b.end_date) return 'The budget must start on or before its end date.';
  if (!/^[A-Z]{3}$/.test(b.currency.trim())) return 'Give the currency as a three letter code, for example KES.';
  if (b.lines.length === 0) return 'Add at least one budget line.';
  for (const [i, l] of b.lines.entries()) {
    if (!l.name.trim()) return `Name budget line ${i + 1}.`;
    if (!validAmount(l.planned_amount)) return `Budget line ${i + 1} needs an amount above zero with at most two decimal places.`;
  }
  return null;
}

/** The first problem with a change request form, or null when the API would take it. */
export function changeFormError(d: ChangeDraft): string | null {
  const title = d.title.trim();
  if (!title) return 'Give the change a title.';
  if (title.length > 200) return 'Keep the title to 200 characters.';
  if (d.kind === 'schedule') {
    if (d.shifts.length === 0) return 'Pick at least one task to move.';
    if (d.shifts.length > MAX_SHIFTS) return `A change moves at most ${MAX_SHIFTS} tasks.`;
    const seen = new Set<string>();
    for (const s of d.shifts) {
      if (!s.task_id) return 'Pick the task for every date shift.';
      if (seen.has(s.task_id)) return 'A task is listed twice. Move it once.';
      seen.add(s.task_id);
      if (!Number.isInteger(s.shift_days) || s.shift_days === 0) return 'Shift every task by a whole number of days, earlier or later.';
      if (Math.abs(s.shift_days) > 3650) return 'Shift a task by at most ten years.';
    }
  }
  if (d.kind === 'cost') {
    if (d.budgetMode === 'existing') return d.budgetId ? null : "Pick the project's budget, or add new budget lines.";
    return budgetError(d.budget);
  }
  return null;
}

/** "3 days later", "1 day earlier". */
export function shiftText(days: number): string {
  const n = Math.abs(days);
  const unit = n === 1 ? 'day' : 'days';
  return days === 0 ? 'No change' : `${n} ${unit} ${days > 0 ? 'later' : 'earlier'}`;
}

/** A YYYY-MM-DD (or RFC 3339) date moved by whole days, as YYYY-MM-DD. */
export function shiftedDate(value: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

/** The treasury push status of a request, read safely from its metadata. */
export function pushStatus(meta: { treasury?: { status?: string } } | undefined | null): string {
  return meta?.treasury?.status ?? 'not_needed';
}

/** Whether a retry may run: a failed push, or one stuck "pushing" for two minutes. */
export function canRetryPush(treasury: { status?: string; attempted_at?: string } | undefined | null, now: Date = new Date()): boolean {
  if (!treasury) return false;
  if (treasury.status === 'failed') return true;
  if (treasury.status === 'pushing' && treasury.attempted_at) {
    const at = Date.parse(treasury.attempted_at);
    return Number.isFinite(at) && now.getTime() - at >= 120_000;
  }
  return false;
}

/** What the signed-in person may do with a request. */
export function changeActions(
  cr: { status: string; requested_by: string },
  me: string,
  perms: { canApprove: boolean; canManage: boolean; canAdd: boolean },
): { decide: boolean; withdraw: boolean; ownRequest: boolean } {
  const pending = cr.status === 'pending';
  const own = !!me && cr.requested_by === me;
  return {
    decide: pending && perms.canApprove && !own,
    withdraw: pending && (perms.canManage || (perms.canAdd && own)),
    ownRequest: own,
  };
}

/** The message for a refused change request write: the server's text where it sent one. */
export function changeErrorText(code: string | undefined, serverText: string | undefined, fallback: string): string {
  const text = (serverText ?? '').trim();
  const say = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  switch (code) {
    case 'own_change_request':
      return 'You raised this change, so someone else has to approve or reject it.';
    case 'not_requester':
      return 'Only the person who raised this change, or a change request manager, can do that.';
    case 'change_request_not_pending':
      return 'This change was already decided or withdrawn. Reload to see where it stands.';
    case 'budget_push_in_progress':
      return 'The budget is being sent to treasury right now. Try again in a moment.';
    case 'budget_push_done':
      return 'The budget is already in treasury.';
    case 'budget_push_not_needed':
      return 'This change has no budget to send to treasury.';
    case 'schedule_conflict':
      return 'Approving would start a task before the tasks it waits on finish, so nothing was changed. Move those tasks in the same request or ask for a new one.';
    default:
      return say(text) || fallback;
  }
}
