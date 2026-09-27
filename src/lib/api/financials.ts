import { apiClient } from './client';

/** Money from treasury arrives as decimal strings; numOf turns it into a number for display. */
export const numOf = (v: unknown): number => (v == null || v === '' ? 0 : Number(v) || 0);

export interface MonthAmount {
  month: string;
  amount: string | number;
}

export interface CostCategory {
  account_id: string;
  account_code: string;
  account_name: string;
  amount: string | number;
}

/** Treasury's view of a project's money (budget, booked cost and revenue, commitments). */
export interface ProjectMoney {
  project_id: string;
  currency: string;
  budget_id?: string;
  budget_status?: string;
  budget_cost: string | number;
  budget_revenue: string | number;
  actual_cost: string | number;
  actual_revenue: string | number;
  committed: string | number;
  margin: string | number;
  margin_pct: number;
  budget_used_pct: number;
  cost_by_category: CostCategory[];
  monthly_cost: MonthAmount[];
  monthly_revenue: MonthAmount[];
  planned_by_month?: MonthAmount[];
}

/** Earned value figures (PMI): CPI and SPI of 1 mean on plan, below 1 is worse. */
export interface EVM {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number;
  spi: number;
  eac: number;
  eac_budget_rate: number;
  etc: number;
  vac: number;
  percent_complete: number;
  percent_planned: number;
  percent_spent: number;
  health: 'green' | 'amber' | 'red' | 'none';
  health_reason?: string;
}

export interface ProjectFinancials {
  project_id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
  currency: string;
  money?: ProjectMoney;
  money_error?: string;
  evm: EVM;
  tasks_total: number;
  tasks_done: number;
  tasks_overdue: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
}

export interface PortfolioParams {
  status?: string;
  page?: number;
  limit?: number;
}

const base = (orgSlug: string) => `/api/v1/${orgSlug}/financials`;

export const financialsApi = {
  project: (orgSlug: string, projectId: string) =>
    apiClient.get<ProjectFinancials>(`${base(orgSlug)}/projects/${projectId}`),
  portfolio: (orgSlug: string, params?: PortfolioParams) =>
    apiClient.get<Paginated<ProjectFinancials>>(`${base(orgSlug)}/portfolio`, params as Record<string, unknown>),
};
