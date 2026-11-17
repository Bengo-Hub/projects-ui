import type { Page } from '@playwright/test';
import { ORG, json } from './qa-mocks';
import { PROJECT_ID } from './work-mocks';
import { M_DONE, M_READY, teamMilestones } from './portal-mocks';

// Mocks for the sprint 15 billing screens: the project's Billing tab, the milestones page's
// invoice badges, the portfolio's client rollup and the portal's invoice list. Add after
// mockTenantApi and mockWorkApi: Playwright tries the most recently added route first.

export const BILLING_VIEW = ['projects.billing.view', 'projects.milestones.view'];
export const BILLING_MANAGE = ['projects.billing.manage', 'projects.milestones.view'];

export const CLIENT_CONTACT = 'ccccccc9-0000-4000-8000-000000000009';
export const PAY_URL = 'https://pay.example.test/i/inv-0002';

export interface BillingInvoice {
  id: string;
  invoice_number: string;
  status: string;
  payment_status: string;
  currency: string;
  total_amount: string;
  amount_paid: string;
  amount_due: string;
  invoice_date: string;
  due_date: string;
  reference_type?: string;
  reference_id?: string;
  is_overdue: boolean;
  public_url?: string;
}

interface MilestoneRow {
  id: string;
  name: string;
  status: string;
  amount?: string;
  amount_pct?: number;
  bill_amount?: string;
  invoice_id?: string;
  invoice_number?: string;
  invoice?: BillingInvoice;
}

export interface BillingState {
  billingType: 'fixed' | 'time_and_materials' | 'retainer' | 'non_billable';
  milestones: MilestoneRow[];
  invoices: BillingInvoice[];
  overviewCalls: number;
  priceCalls: { milestoneId: string; body: Record<string, unknown> }[];
  invoiceCalls: string[];
  timeCalls: Record<string, unknown>[];
  retainerCalls: Record<string, unknown>[];
  /** The next time invoice answers 422 nothing_to_bill. */
  nothingToBill: boolean;
}

const CONTRACT = 400000;

function invoice(n: number, over: Partial<BillingInvoice> = {}): BillingInvoice {
  return {
    id: `inv-${n}`,
    invoice_number: `INV-000${n}`,
    // What treasury answers for an invoice projects created: a draft (keep_draft), not sent yet.
    status: 'draft',
    payment_status: 'unpaid',
    currency: 'KES',
    total_amount: '0.00',
    amount_paid: '0.00',
    amount_due: '0.00',
    invoice_date: '2026-11-17T00:00:00Z',
    due_date: '2026-12-17T00:00:00Z',
    is_overdue: false,
    ...over,
  };
}

export function freshBilling(over: Partial<BillingState> = {}): BillingState {
  const paid = invoice(1, {
    status: 'sent',
    payment_status: 'paid',
    total_amount: '50000.00',
    amount_paid: '50000.00',
    amount_due: '0.00',
    reference_type: 'project_milestone',
    reference_id: M_DONE,
  });
  return {
    billingType: 'fixed',
    milestones: [
      { id: M_DONE, name: 'Site survey', status: 'approved', amount: '50000.00', bill_amount: '50000.00', invoice_id: paid.id, invoice_number: paid.invoice_number, invoice: paid },
      { id: M_READY, name: 'Ground floor handover', status: 'changes_requested', amount: '120000.00', bill_amount: '120000.00' },
    ],
    invoices: [paid],
    overviewCalls: 0,
    priceCalls: [],
    invoiceCalls: [],
    timeCalls: [],
    retainerCalls: [],
    nothingToBill: false,
    ...over,
  };
}

function terms(s: BillingState) {
  const base = { billing_type: s.billingType, currency: 'KES', retainer_rollover: false, client_id: CLIENT_CONTACT, client_name: 'Riverside Health' };
  if (s.billingType === 'fixed') return { ...base, contract_value: CONTRACT };
  if (s.billingType === 'time_and_materials') return { ...base, hourly_rate: '2500.00' };
  if (s.billingType === 'retainer') return { ...base, retainer_amount: '80000.00', retainer_hours: 20, retainer_rollover: true };
  return base;
}

export async function mockBillingApi(page: Page, s: BillingState) {
  const p = `/api/v1/${ORG}/projects/${PROJECT_ID}`;
  await page.route(new RegExp(`${p}/milestones$`), (r) => json(r, { data: teamMilestones() }));
  await page.route(new RegExp(`${p}/billing$`), (r) => {
    s.overviewCalls++;
    return json(r, {
      terms: terms(s),
      milestones: s.milestones,
      invoices: s.invoices,
      invoices_total: s.invoices.length,
      ...(s.billingType === 'time_and_materials' ? { unbilled_hours: 12.5, unbilled_estimate: '31250.00' } : {}),
      treasury_unavailable: false,
      erp_unavailable: false,
    });
  });
  await page.route(new RegExp(`${p}/billing/milestones/[^/]+$`), (r) => {
    const milestoneId = r.request().url().split('/').pop() ?? '';
    const body = r.request().postDataJSON() as { amount: string | null; amount_pct: number | null };
    s.priceCalls.push({ milestoneId, body });
    const m = s.milestones.find((x) => x.id === milestoneId)!;
    m.amount = body.amount ?? undefined;
    m.amount_pct = body.amount_pct ?? undefined;
    m.bill_amount = body.amount ?? (body.amount_pct != null ? ((CONTRACT * body.amount_pct) / 100).toFixed(2) : undefined);
    return json(r, m);
  });
  await page.route(new RegExp(`${p}/billing/milestones/[^/]+/invoice$`), (r) => {
    const milestoneId = r.request().url().split('/').slice(-2)[0];
    s.invoiceCalls.push(milestoneId);
    const m = s.milestones.find((x) => x.id === milestoneId)!;
    const inv = invoice(s.invoices.length + 1, { total_amount: m.bill_amount ?? '0', amount_due: m.bill_amount ?? '0', reference_type: 'project_milestone', reference_id: milestoneId });
    s.invoices.unshift(inv);
    Object.assign(m, { invoice_id: inv.id, invoice_number: inv.invoice_number, invoice: inv });
    return json(r, inv);
  });
  await page.route(new RegExp(`${p}/billing/time-invoice$`), (r) => {
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.timeCalls.push(body);
    if (s.nothingToBill) {
      s.nothingToBill = false;
      return json(r, { error: 'no approved billable hours in that period', code: 'nothing_to_bill' }, 422);
    }
    const inv = invoice(s.invoices.length + 1, { total_amount: '25000.00', amount_due: '25000.00', reference_type: 'project_time' });
    s.invoices.unshift(inv);
    return json(r, { invoice: inv, entries: 3, hours: 10, warning: '2 entries had no rate and were left out.' });
  });
  await page.route(new RegExp(`${p}/billing/retainer-invoice$`), (r) => {
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.retainerCalls.push(body);
    const inv = invoice(s.invoices.length + 1, { total_amount: '80000.00', amount_due: '80000.00', reference_type: 'project_retainer' });
    s.invoices.unshift(inv);
    return json(r, { invoice: inv });
  });
}

/** GET /financials/clients: two clients, cut short at the project cap. */
export async function mockClientRollup(page: Page) {
  await page.route(new RegExp(`/api/v1/${ORG}/financials/clients(\\?.*)?$`), (r) =>
    json(r, {
      clients: [
        { client_id: CLIENT_CONTACT, client_name: 'Riverside Health', currency: 'KES', projects: 2, contract_value: 900000, invoiced: 450000, unbilled: 450000, labour_cost: 120000, cost_to_date: 300000, margin_to_date: 150000, margin_pct: 33.3 },
        { client_id: 'ccccccc8-0000-4000-8000-000000000008', client_name: 'Lakeside Schools', currency: 'KES', projects: 1, contract_value: 0, invoiced: 60000, unbilled: 0, labour_cost: 70000, cost_to_date: 90000, margin_to_date: -30000, margin_pct: -50 },
      ],
      truncated: true,
      money_unavailable: false,
    }),
  );
}

/** The portal's invoices once billing is connected: one overdue with a pay link, one paid. */
export async function mockPortalInvoices(page: Page) {
  await page.route(new RegExp(`/api/v1/${ORG}/portal/projects/${PROJECT_ID}/invoices(\\?.*)?$`), (r) =>
    json(r, {
      data: [
        invoice(2, { status: 'sent', payment_status: 'partial', total_amount: '120000.00', amount_paid: '20000.00', amount_due: '100000.00', due_date: '2026-11-01T00:00:00Z', is_overdue: true, public_url: PAY_URL }),
        invoice(1, { status: 'sent', payment_status: 'paid', total_amount: '50000.00', amount_paid: '50000.00', amount_due: '0.00', public_url: 'https://pay.example.test/i/inv-0001' }),
      ],
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
      available: true,
    }),
  );
}
