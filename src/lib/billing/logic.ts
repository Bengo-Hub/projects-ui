// Billing rules the screens share (sprint 15). No React, no aliases and no runtime imports, so
// node-tests can load this file directly.

/** Money from treasury may arrive as a number or a decimal string; anything else reads as 0. */
export function moneyOf(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The first and last day of the month before today's, as YYYY-MM-DD in local time. */
export function lastMonthRange(today: Date): { from: string; to: string } {
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: ymd(first), to: ymd(last) };
}

/** Today's month as YYYY-MM. */
export function monthOf(today: Date): string {
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
}

/** Whether from and to are real dates with from on or before to. */
export function validPeriod(from: string, to: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to)) return false;
  return from <= to;
}

/** A price the API takes: above zero, at most two decimal places. */
export function validPrice(v: string): boolean {
  const s = v.trim();
  return /^\d{1,12}(\.\d{1,2})?$/.test(s) && Number(s) > 0;
}

/** A share of the contract value: above 0 and at most 100. */
export function validPercent(v: string): boolean {
  const s = v.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return false;
  const n = Number(s);
  return n > 0 && n <= 100;
}

export interface InvoiceLike {
  status?: string;
  payment_status?: string;
  amount_due?: unknown;
  total_amount?: unknown;
  is_overdue?: boolean;
}

export type InvoiceState = 'void' | 'paid' | 'overdue' | 'partial' | 'draft' | 'to_send' | 'unpaid';

/**
 * One state for an invoice's badge. Void and cancelled come first, then paid (a paid invoice is
 * never overdue), then overdue from treasury's is_overdue, then partly paid, then draft, then
 * ready to send. Projects creates its invoices as drafts in treasury (owner, 17 November 2026);
 * once the firm approves one there it reads "Ready to send" until it is sent.
 */
export function invoiceState(inv: InvoiceLike): InvoiceState {
  const status = (inv.status ?? '').toLowerCase();
  const pay = (inv.payment_status ?? '').toLowerCase();
  if (status === 'void' || status === 'voided' || status === 'cancelled' || status === 'canceled') return 'void';
  if (pay === 'paid' || status === 'paid') return 'paid';
  if (inv.is_overdue) return 'overdue';
  if (pay === 'partial' || pay === 'partially_paid' || status === 'partially_paid') return 'partial';
  if (status === 'draft') return 'draft';
  if (status === 'approved' || status === 'pending_approval') return 'to_send';
  return 'unpaid';
}

export const INVOICE_STATE_LABEL: Record<InvoiceState, string> = {
  void: 'Void',
  paid: 'Paid',
  overdue: 'Overdue',
  partial: 'Partly paid',
  draft: 'Draft',
  to_send: 'Ready to send',
  unpaid: 'Unpaid',
};

/** Whether an invoice still bills something (not voided or cancelled). */
export function isLiveInvoice(inv: InvoiceLike | null | undefined): boolean {
  return !!inv && invoiceState(inv) !== 'void';
}

export interface MilestonePriceLike {
  amount?: string;
  amount_pct?: number;
  bill_amount?: string;
}

/** Whether the milestone has a price an invoice can charge. */
export function hasPrice(m: MilestonePriceLike): boolean {
  return moneyOf(m.bill_amount) > 0 || moneyOf(m.amount) > 0;
}

/** What a milestone would bill, from bill_amount, else its fixed amount. */
export function billAmountOf(m: MilestonePriceLike): number {
  return moneyOf(m.bill_amount) || moneyOf(m.amount);
}

/** The reason a milestone cannot be invoiced yet, or null when it can. */
export function milestoneInvoiceBlock(m: MilestonePriceLike, terms: { client_id?: string; billing_type?: string }): string | null {
  if (terms.billing_type === 'non_billable') return 'This project is not billed.';
  if (!terms.client_id) return 'Set the client on the contract first.';
  if (!hasPrice(m)) return 'Set a price first.';
  return null;
}

export type ToastKind = 'info' | 'error';

/**
 * The toast for a refused billing write: the server's own text where it sent one, with a plain
 * fallback per code. nothing_to_bill is information, not a failure.
 */
export function billingErrorToast(code: string | undefined, serverText: string | undefined, fallback: string): { kind: ToastKind; message: string } {
  const text = (serverText ?? '').trim();
  const say = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  switch (code) {
    case 'nothing_to_bill':
      return { kind: 'info', message: say(text) || 'There is nothing to bill for that period.' };
    case 'invoice_in_progress':
      return { kind: 'error', message: `${(say(text) || 'An invoice for this is being created right now').replace(/\.+$/, '')}. Try again in a moment.` };
    case 'billing_unavailable':
      return { kind: 'error', message: say(text) || 'Billing is not set up for this organisation yet.' };
    case 'upstream_unavailable':
      return { kind: 'error', message: say(text) || 'Treasury or ERP is not answering. Try again shortly.' };
    case 'not_found':
      return { kind: 'error', message: say(text) || 'That project or milestone no longer exists.' };
    default:
      return { kind: 'error', message: say(text) || fallback };
  }
}

/** The invoice's page in treasury-ui, which routes invoices at /{orgSlug}/invoices/{id}. */
export function treasuryInvoiceUrl(treasuryBase: string, orgSlug: string, invoiceId: string): string {
  return `${treasuryBase.replace(/\/+$/, '')}/${encodeURIComponent(orgSlug)}/invoices/${encodeURIComponent(invoiceId)}`;
}

/** Whether a public invoice link is safe to open (http or https only). */
export function safePayUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
