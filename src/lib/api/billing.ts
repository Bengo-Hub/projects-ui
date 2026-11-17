import { apiClient } from './client';

// Project billing (sprint 15, projects-api internal/http/handlers/billing.go). Treasury owns the
// invoices; projects-api creates them over S2S (treasury approves them, the firm sends them from
// treasury) and keeps only their ids.

/** A decimal string or a number: treasury sends money either way. Read with moneyOf. */
export type MoneyValue = number | string;

export type ProjectBillingType = 'fixed' | 'time_and_materials' | 'retainer' | 'non_billable' | '';

/** A treasury invoice as projects-api passes it on. */
export interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  payment_status: string;
  currency: string;
  total_amount: MoneyValue;
  amount_paid: MoneyValue;
  amount_due: MoneyValue;
  invoice_date: string;
  due_date: string;
  reference_type?: string;
  reference_id?: string;
  is_overdue: boolean;
  public_url?: string;
}

export interface BillingTerms {
  billing_type: ProjectBillingType;
  currency: string;
  contract_value?: number;
  hourly_rate?: string;
  retainer_amount?: string;
  retainer_hours?: number;
  retainer_rollover: boolean;
  client_id?: string;
  client_name?: string;
  cost_center_id?: string;
}

export interface MilestoneBilling {
  id: string;
  name: string;
  status: string;
  amount?: string;
  amount_pct?: number;
  /** What an invoice would charge now. */
  bill_amount?: string;
  invoice_id?: string;
  invoice_number?: string;
  invoice?: Invoice;
}

export interface BillingOverview {
  terms: BillingTerms;
  milestones: MilestoneBilling[];
  invoices: Invoice[];
  invoices_total: number;
  unbilled_hours?: number;
  unbilled_estimate?: string;
  treasury_unavailable: boolean;
  erp_unavailable: boolean;
}

/** One or the other; both null clears the price. */
export interface MilestonePriceInput {
  amount: string | null;
  amount_pct: number | null;
}

export interface TimeInvoiceResult {
  invoice: Invoice;
  entries?: number;
  hours?: number;
  warning?: string;
}

/** treasury-ui, where the invoices live (the same variable the financials page and app switcher read). */
export const TREASURY_UI = process.env.NEXT_PUBLIC_TREASURY_UI_URL ?? 'https://books.codevertexafrica.com';

const base = (orgSlug: string, projectId: string) => `/api/v1/${orgSlug}/projects/${projectId}/billing`;

export const billingApi = {
  overview: (orgSlug: string, projectId: string) => apiClient.get<BillingOverview>(base(orgSlug, projectId)),
  setMilestonePrice: (orgSlug: string, projectId: string, milestoneId: string, body: MilestonePriceInput) =>
    apiClient.put<MilestoneBilling>(`${base(orgSlug, projectId)}/milestones/${milestoneId}`, body),
  invoiceMilestone: (orgSlug: string, projectId: string, milestoneId: string) =>
    apiClient.post<Invoice>(`${base(orgSlug, projectId)}/milestones/${milestoneId}/invoice`),
  invoiceTime: (orgSlug: string, projectId: string, body: { from: string; to: string }) =>
    apiClient.post<TimeInvoiceResult>(`${base(orgSlug, projectId)}/time-invoice`, body),
  invoiceRetainer: (orgSlug: string, projectId: string, body: { month: string }) =>
    apiClient.post<{ invoice: Invoice }>(`${base(orgSlug, projectId)}/retainer-invoice`, body),
};
