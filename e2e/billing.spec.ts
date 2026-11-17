import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ORG, STAFF_FEATURES, freshTenant, mockTenantApi, signIn } from './qa-mocks';
import { PROJECT_ID, WORK_PERMISSIONS, freshWork, mockWorkApi } from './work-mocks';
import { M_READY, freshPortal, mockPortalApi, signInPortal } from './portal-mocks';
import { BILLING_MANAGE, BILLING_VIEW, PAY_URL, freshBilling, mockBillingApi, mockClientRollup, mockPortalInvoices, type BillingState } from './billing-mocks';

// Sprint 15 billing and profitability at phone (390 px) and desktop widths, every API call mocked.

async function setup(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  opts: { permissions?: string[]; billing?: Partial<BillingState>; features?: string[] } = {},
) {
  const user = await signIn(context, baseURL, opts.features ?? STAFF_FEATURES);
  await mockTenantApi(page, freshTenant({ permissions: opts.permissions ?? [...WORK_PERMISSIONS, ...BILLING_MANAGE] }), user);
  await mockWorkApi(page, freshWork());
  const s = freshBilling(opts.billing);
  await mockBillingApi(page, s);
  return s;
}

const billingUrl = `/${ORG}/projects/${PROJECT_ID}/billing`;
const visible = (page: Page, text: string | RegExp) => page.getByText(text).filter({ visible: true }).first();

test('the billing tab lists the milestones and creates a milestone invoice in treasury', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}`);
  await page.getByRole('link', { name: 'Billing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
  await expect(page.getByTestId('billing-terms')).toContainText('Riverside Health');
  await expect(visible(page, 'Ground floor handover')).toBeVisible();
  // The survey is already invoiced and paid; its price is fixed while the invoice is live.
  await expect(page.getByTestId('milestone-invoice').filter({ visible: true }).first()).toContainText('INV-0001');
  await expect(page.getByRole('button', { name: 'Create invoice for Site survey' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Set price for Site survey' })).toBeDisabled();

  await page.getByRole('button', { name: 'Create invoice for Ground floor handover' }).click();
  await expect.poll(() => s.invoiceCalls).toEqual([M_READY]);
  await expect(page.getByText(/INV-0002 is ready as a draft in treasury/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open in treasury' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create invoice for Ground floor handover' })).toHaveCount(0);

  // The milestones page shows the same invoice with its payment badge.
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/milestones`);
  const paid = page.getByTestId('milestone-invoice').filter({ hasText: 'INV-0001' });
  await expect(paid).toContainText('Paid');
});

test('a milestone is priced as a share of the contract value', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(billingUrl);
  await page.getByRole('button', { name: 'Set price for Ground floor handover' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Share of contract' }).click();
  await dialog.getByLabel('Percent of contract value').fill('30');
  await expect(dialog).toContainText(/30% of .+ is .+120,000/);
  await dialog.getByRole('button', { name: 'Save price' }).click();
  await expect.poll(() => s.priceCalls).toEqual([{ milestoneId: M_READY, body: { amount: null, amount_pct: 30 } }]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(visible(page, '30% of contract')).toBeVisible();
});

test('time is invoiced for last month and the warning shows', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { billing: { billingType: 'time_and_materials', milestones: [], invoices: [] } });
  await page.goto(billingUrl);
  await expect(page.getByText('12.5 h')).toBeVisible();
  await page.getByRole('button', { name: 'Invoice time' }).click();
  await expect.poll(() => s.timeCalls.length).toBe(1);
  const body = s.timeCalls[0] as { from: string; to: string };
  expect(body.from).toMatch(/^\d{4}-\d{2}-01$/);
  expect(body.to > body.from).toBe(true);
  await expect(page.getByTestId('time-warning')).toContainText('2 entries had no rate and were left out.');
});

test('nothing to bill is an information toast, not an error', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { billing: { billingType: 'time_and_materials', milestones: [], invoices: [], nothingToBill: true } });
  await page.goto(billingUrl);
  await page.getByRole('button', { name: 'Invoice time' }).click();
  await expect(page.getByText('No approved billable hours in that period')).toBeVisible();
  expect(s.invoices).toHaveLength(0);
});

test('a retainer is invoiced for this month', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { billing: { billingType: 'retainer', milestones: [], invoices: [] } });
  await page.goto(billingUrl);
  await expect(page.getByTestId('billing-terms')).toContainText('20 h a month');
  await page.getByRole('button', { name: 'Invoice this month' }).click();
  await expect.poll(() => s.retainerCalls.length).toBe(1);
  expect(String(s.retainerCalls[0].month)).toMatch(/^\d{4}-\d{2}$/);
  await expect(page.getByText(/Retainer invoice INV-0001 is ready as a draft in treasury/)).toBeVisible();
});

test('a read-only user sees billing without any write buttons', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...BILLING_VIEW] });
  await page.goto(billingUrl);
  await expect(visible(page, 'Ground floor handover')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Create invoice for/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Set price for/ })).toHaveCount(0);
});

test('a tenant without milestone billing sees the plan lock and no billing call', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { features: STAFF_FEATURES.filter((f) => f !== 'milestone_billing') });
  await page.goto(`/${ORG}/projects/${PROJECT_ID}`);
  await expect(page.getByRole('link', { name: 'Tasks' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Billing', exact: true })).toHaveCount(0);
  await page.goto(billingUrl);
  await expect(page.getByRole('heading', { name: 'Project billing is part of Milestone Billing' })).toBeVisible();
  expect(s.overviewCalls).toBe(0);
});

test('the portfolio adds up margin by client', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, 'projects.financials.view'] });
  await mockClientRollup(page);
  await page.goto(`/${ORG}/portfolio`);
  await page.getByRole('tab', { name: 'By client' }).click();
  const rollup = page.getByTestId('client-rollup');
  await expect(rollup.getByText('Riverside Health').filter({ visible: true }).first()).toBeVisible();
  await expect(rollup.getByText('Lakeside Schools').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByTestId('rollup-truncated')).toBeVisible();
});

test('the portal lists sent invoices with a pay link', async ({ page, context, baseURL }) => {
  await signInPortal(context, baseURL!);
  await mockPortalApi(page, freshPortal());
  await mockPortalInvoices(page);
  await page.goto(`/${ORG}/portal/projects/${PROJECT_ID}?tab=invoices`);
  const rows = page.getByTestId('portal-invoice');
  await expect(rows).toHaveCount(2);
  const overdue = rows.filter({ hasText: 'INV-0002' });
  await expect(overdue).toContainText('Overdue');
  await expect(overdue.getByRole('link', { name: 'View and pay' })).toHaveAttribute('href', PAY_URL);
  const paid = rows.filter({ hasText: 'INV-0001' });
  await expect(paid).toContainText('Paid');
  await expect(paid.getByRole('link', { name: 'View invoice' })).toBeVisible();
});
