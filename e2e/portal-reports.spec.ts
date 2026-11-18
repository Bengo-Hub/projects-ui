import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ORG } from './qa-mocks';
import { PROJECT_ID } from './work-mocks';
import { freshPortal, mockPortalApi, signInPortal } from './portal-mocks';
import { PR_MONEY, PR_PLAIN, mockPortalReportsApi, type PortalReportsState } from './reports-mocks';

// The status reports a firm shared with its client (sprint 7 with sprint 14 US-14.5), at phone
// (390 px) and desktop widths, every API call mocked.

async function setup(page: Page, context: BrowserContext, baseURL: string) {
  await signInPortal(context, baseURL);
  await mockPortalApi(page, freshPortal());
  const s: PortalReportsState = { pdfCalls: 0 };
  await mockPortalReportsApi(page, s);
  return s;
}

const tabUrl = `/${ORG}/portal/projects/${PROJECT_ID}?tab=reports`;

test('the reports tab lists the shared reports newest first and opens one as a readable page', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!);
  await page.goto(tabUrl);
  const rows = page.getByTestId('portal-report');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Week 45 report');
  await rows.first().click();
  await expect(page).toHaveURL(new RegExp(`report=${PR_PLAIN}`));
  const view = page.getByTestId('report-view');
  await expect(view).toContainText('Foundations are done');
  await expect(view).toContainText('Pour foundation slab finished');
  await expect(page.getByTestId('report-risks')).toContainText('Steel delivery runs late');
  await expect(page.getByTestId('report-milestones')).toContainText('Shell complete');
  // No financials were included, and the script in the narrative never runs or shows.
  await expect(page.getByTestId('report-financials')).toHaveCount(0);
  await expect(view).not.toContainText('alert(1)');
  await page.getByRole('button', { name: 'All reports' }).click();
  await expect(page.getByTestId('portal-report')).toHaveCount(2);
});

test('the share notice link opens the report, with its financials when the team included them, and the PDF downloads', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`${tabUrl}&report=${PR_MONEY}`);
  await expect(page.getByTestId('report-view')).toContainText('Week 44 report');
  await expect(page.getByTestId('report-financials')).toBeVisible();
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect.poll(() => s.pdfCalls).toBe(1);
});

test('a report taken out of the portal says it is not available', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!);
  await page.goto(`${tabUrl}&report=f4000009-0000-4000-8000-000000000009`);
  await expect(page.getByText('Report not available').first()).toBeVisible();
});
