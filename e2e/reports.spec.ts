import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { ORG, freshTenant, json, mockTenantApi, serviceProfile, signIn, STAFF_FEATURES } from './qa-mocks';
import { PROJECT_ID, WORK_PERMISSIONS, freshWork, mockWorkApi } from './work-mocks';
import { R_DRAFT, R_NEW, R_PUB, REPORTS_MANAGE, REPORTS_VIEW, freshReports, mockReportsApi, unratedDraft, type ReportsState } from './reports-mocks';

// Sprint 7 status reports and the weekly digest switch at phone (390 px) and desktop widths, every
// API call mocked.

async function setup(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  opts: { permissions?: string[]; reports?: Partial<ReportsState>; features?: string[]; adminTier?: boolean } = {},
) {
  const user = await signIn(context, baseURL, opts.features ?? STAFF_FEATURES);
  const tenant = freshTenant({ permissions: opts.permissions ?? [...WORK_PERMISSIONS, ...REPORTS_MANAGE] });
  await mockTenantApi(page, tenant, user);
  await mockWorkApi(page, freshWork());
  const s = freshReports(opts.reports);
  await mockReportsApi(page, s, { adminTier: opts.adminTier });
  if (opts.adminTier) {
    // The admin tier: the projects_admin role (projects-api's RequireAdminTier).
    await page.route(new RegExp(`/api/v1/${ORG}/auth/me$`), (r) => json(r, { ...serviceProfile(tenant, user), service_role: 'projects_admin', roles: ['projects_admin'] }));
  }
  return s;
}

const reportsUrl = `/${ORG}/projects/${PROJECT_ID}/reports`;
const visible = (scope: Page | Locator, text: string | RegExp) => scope.getByText(text).filter({ visible: true }).first();

/** The last full week, Monday to Sunday, as the dialog works it out. */
function lastWeek(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const wd = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (wd - 1));
  return { start: ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7)), end: ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1)) };
}

test('the project tabs link reports and governance', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...REPORTS_VIEW] });
  await page.goto(`/${ORG}/projects/${PROJECT_ID}`);
  await expect(page.getByRole('link', { name: 'Reports', exact: true })).toHaveAttribute('href', reportsUrl);
  await expect(page.getByRole('link', { name: 'Governance', exact: true })).toHaveAttribute('href', `/${ORG}/projects/${PROJECT_ID}/governance`);
});

test('the history lists reports newest period first with status, rating and the shared marker', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { reports: { reports: [freshReports().reports[0], { ...freshReports().reports[1], client_visible: true }] } });
  await page.goto(reportsUrl);
  await expect(page.getByRole('heading', { name: 'Status reports' })).toBeVisible();
  await expect(visible(page, 'Week 45 report')).toBeVisible();
  await expect(visible(page, 'Week 44 report')).toBeVisible();
  await expect(page.getByTestId('report-status').filter({ visible: true })).toHaveText(['Draft', 'Published']);
  await expect(page.getByLabel('Overall: Amber').filter({ visible: true }).first()).toBeVisible();
  if (page.viewportSize()!.width >= 640) await expect(page.getByTestId('shared-marker').filter({ visible: true })).toHaveCount(1);
});

test('a new report opens for last week by default and lands in the editor', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(reportsUrl);
  await page.getByRole('button', { name: 'New report' }).click();
  const dialog = page.getByRole('dialog');
  const week = lastWeek();
  await expect(dialog.getByLabel('First day')).toHaveValue(week.start);
  await expect(dialog.getByLabel('Last day')).toHaveValue(week.end);
  await dialog.getByLabel('Report title').fill('Weekly update');
  await dialog.getByRole('button', { name: 'Open draft' }).click();
  await expect.poll(() => s.posts).toEqual([{ period_start: week.start, period_end: week.end, title: 'Weekly update' }]);
  await expect(page).toHaveURL(new RegExp(`/reports/${R_NEW}$`));
  await expect(page.getByTestId('report-editor')).toBeVisible();
});

test('a period already reported says so in the dialog', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(reportsUrl);
  await page.getByRole('button', { name: 'New report' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('First day').fill('2026-11-02');
  await dialog.getByLabel('Last day').fill('2026-11-08');
  await dialog.getByRole('button', { name: 'Open draft' }).click();
  await expect(dialog.getByTestId('report-exists')).toHaveText('There is already a report for this period. Open it from the history.');
  expect(s.posts).toHaveLength(1);
  // A backwards period never reaches the API.
  await dialog.getByLabel('Last day').fill('2026-11-01');
  await dialog.getByRole('button', { name: 'Open draft' }).click();
  await expect(dialog.getByText('The last day must be on or after the first day.')).toBeVisible();
  expect(s.posts).toHaveLength(1);
});

test('a draft is rated, trimmed, saved and published', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`${reportsUrl}/${R_DRAFT}`);
  const editor = page.getByTestId('report-editor');
  // Each rating shows the suggestion and its reason.
  await expect(editor.getByTestId('rag-picker-schedule').getByTestId('rag-suggestion')).toContainText('Suggested: Amber, schedule index 0.90, behind plan');
  await editor.getByRole('radio', { name: 'Overall Red' }).click();
  await editor.getByRole('button', { name: 'Add highlight' }).click();
  await editor.getByLabel('Highlight 2', { exact: true }).fill('Roof trusses ordered');
  await editor.getByRole('button', { name: 'Leave out risk Steel delivery runs late' }).click();
  await expect(editor.getByTestId('unsaved-note')).toBeVisible();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => s.puts).toEqual([
    { id: R_DRAFT, body: { rag_overall: 'red', highlights: ['Pour foundation slab finished', 'Roof trusses ordered'], risks: [] } },
  ]);
  await expect(page.getByTestId('unsaved-note')).toHaveCount(0);

  await page.getByTestId('report-editor').getByRole('button', { name: 'Publish' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish report' }).click();
  await expect.poll(() => s.publishes).toEqual([R_DRAFT]);
  await expect(page.getByTestId('report-editor')).toHaveCount(0);
  await expect(page.getByTestId('report-status')).toHaveText('Published');
  await expect(page.getByTestId('report-view').getByLabel('Overall: Red')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share with client' })).toBeVisible();
});

test('publishing without an overall rating says what is missing and sends nothing', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { reports: { reports: [unratedDraft()] } });
  await page.goto(`${reportsUrl}/${R_DRAFT}`);
  await page.getByTestId('report-editor').getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByTestId('publish-problem')).toHaveText('Set the overall rating before publishing.');
  expect(s.publishes).toEqual([]);
});

test('a draft is refreshed, previewed with its PDF and deleted after a confirm', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`${reportsUrl}/${R_DRAFT}`);
  const editor = page.getByTestId('report-editor');
  await editor.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => s.refreshes).toEqual([R_DRAFT]);

  await editor.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog');
  await expect(preview.getByTestId('report-view')).toContainText('Foundations are done; steel is the worry.');
  await expect(preview.getByTestId('report-financials')).toBeVisible();
  await preview.getByRole('button', { name: 'Open the PDF' }).click();
  await expect.poll(() => s.pdfCalls).toBe(1);
  // Opening the PDF closes the preview. The viewer keeps focus in its frame, so it is closed with
  // its Close button, as a person would.
  await expect(page.getByTestId('report-view')).toHaveCount(0);
  await page.getByRole('dialog').filter({ hasText: '.pdf' }).getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Delete draft' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete draft' }).click();
  await expect.poll(() => s.deletes).toEqual([R_DRAFT]);
  await expect(page).toHaveURL(new RegExp(`/reports$`));
});

test('a role without financial access sees the financials hidden note', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, {
    permissions: [...WORK_PERMISSIONS, 'projects.reports.manage'],
    reports: { hideFinancials: true },
  });
  await page.goto(`${reportsUrl}/${R_DRAFT}`);
  await expect(page.getByTestId('financials-hidden')).toHaveText('Financials are hidden for your role.');
  await expect(page.getByTestId('report-financials')).toHaveCount(0);
});

test('a published report is shared with financials, downloaded and unshared', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`${reportsUrl}/${R_PUB}`);
  await expect(page.getByTestId('report-sharing')).toContainText('Not shared with the client.');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect.poll(() => s.pdfCalls).toBe(1);
  await page.getByRole('dialog').filter({ hasText: '.pdf' }).getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Share with client' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Include financials').check();
  await dialog.getByRole('button', { name: 'Share report' }).click();
  await expect.poll(() => s.shares).toEqual([{ id: R_PUB, body: { include_financials: true } }]);
  await expect(page.getByTestId('report-sharing')).toContainText('Shared with the client');
  await expect(page.getByTestId('report-sharing')).toContainText('by Owner, with financials.');

  await page.getByRole('button', { name: 'Unshare' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Unshare' }).click();
  await expect.poll(() => s.unshares).toEqual([R_PUB]);
  await expect(page.getByTestId('report-sharing')).toContainText('Not shared with the client.');
});

test('without financials.view the share dialog offers no financials and sends none', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, 'projects.reports.manage', 'projects.portal.manage'], reports: { hideFinancials: true } });
  await page.goto(`${reportsUrl}/${R_PUB}`);
  await page.getByRole('button', { name: 'Share with client' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('share-without-financials')).toBeVisible();
  await expect(dialog.getByLabel('Include financials')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Share report' }).click();
  await expect.poll(() => s.shares).toEqual([{ id: R_PUB, body: { include_financials: false } }]);
});

test('without the budget_tracking feature the share dialog offers no financials', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { features: STAFF_FEATURES.filter((f) => f !== 'budget_tracking') });
  await page.goto(`${reportsUrl}/${R_PUB}`);
  await page.getByRole('button', { name: 'Share with client' }).click();
  await expect(page.getByRole('dialog').getByLabel('Include financials')).toHaveCount(0);
});

test('a reader sees the history and a read-only draft, with no write buttons', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...REPORTS_VIEW] });
  await page.goto(reportsUrl);
  await expect(visible(page, 'Week 45 report')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New report' })).toHaveCount(0);
  await visible(page, 'Week 45 report').click();
  await expect(page).toHaveURL(new RegExp(`/reports/${R_DRAFT}$`));
  await expect(page.getByTestId('report-view')).toBeVisible();
  await expect(page.getByTestId('report-editor')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Draft PDF' })).toBeVisible();
});

test('a role without reports.view is sent to the unauthorized page', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: WORK_PERMISSIONS });
  await page.goto(reportsUrl);
  await expect(page).toHaveURL(new RegExp(`/${ORG}/unauthorized$`));
});

// The weekly digest switch.

test('a reader sees the digest state but cannot change it', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...REPORTS_VIEW] });
  await page.goto(`/${ORG}/settings/notifications`);
  const sw = page.getByRole('switch', { name: 'Weekly digest' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(sw).toBeDisabled();
  await expect(page.getByTestId('digest-admin-note')).toBeVisible();
  expect(s.digestPuts).toEqual([]);
});

test('an administrator switches the weekly digest off', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { adminTier: true });
  await page.goto(`/${ORG}/settings/notifications`);
  const sw = page.getByRole('switch', { name: 'Weekly digest' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect.poll(() => s.digestPuts).toEqual([{ weekly_enabled: false }]);
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('The weekly digest is off')).toBeVisible();
});
