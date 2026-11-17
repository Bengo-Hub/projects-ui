import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ORG } from './qa-mocks';
import { PROJECT_ID } from './work-mocks';
import { CLIENT_ID, M_READY, freshPortal, mockPortalApi, signInPortal, type PortalState } from './portal-mocks';

// Sprint 14 client portal at phone (390 px) and desktop widths, every API call mocked. The client
// signs in through the portal's own session; no staff shell shows anywhere.

async function setup(page: Page, context: BrowserContext, baseURL: string, over: Partial<PortalState> = {}) {
  const s = freshPortal(over);
  await signInPortal(context, baseURL);
  await mockPortalApi(page, s);
  return s;
}

test('the landing lists the shared projects with progress, in the firm-branded portal without the staff shell', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/portal`);
  await expect(page.getByTestId('portal-brand')).toContainText('Acme Works');
  const card = page.getByTestId('portal-project-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Riverside clinic fit-out');
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  await expect(card).toContainText('1 milestone waiting for you');
  // The progress comes with the list: no card asks for its own summary.
  expect(s.summaryCalls).toBe(0);
  await expect(page.getByTestId('verify-email-banner')).toHaveCount(0);
  await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);
  await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});

test('an unverified email gets the banner pointing at the accounts site', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { emailNotVerified: true });
  await page.goto(`/${ORG}/portal`);
  const banner = page.getByTestId('verify-email-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Verify your email to open the projects shared with you');
  await expect(banner.getByRole('link', { name: 'Verify my email' })).toHaveAttribute('href', /\/dashboard\/profile\?tab=email$/);
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
});

test('a client approves a milestone ready for review', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/portal/projects/${PROJECT_ID}?milestone=${M_READY}`);
  const ready = page.getByTestId('portal-milestone').filter({ hasText: 'Ground floor handover' });
  await expect(ready).toContainText('Ready for your review');
  // The earlier decision on the survey reads back with who made it and the comment.
  const survey = page.getByTestId('portal-milestone').filter({ hasText: 'Site survey' });
  await expect(survey.getByTestId('milestone-decision')).toContainText('Approved by Jane Client');
  await expect(survey.getByTestId('milestone-decision')).toContainText('Looks right.');
  await ready.getByRole('radio', { name: 'Approve' }).click();
  await ready.getByRole('textbox').fill('Great work on the floors.');
  await ready.getByRole('button', { name: 'Approve milestone' }).click();
  await expect.poll(() => s.decisions.length).toBe(1);
  expect(s.decisions[0]).toEqual({ milestoneId: M_READY, body: { decision: 'approve', comment: 'Great work on the floors.' } });
  await expect(ready).toContainText('Approved');
  await expect(ready.getByRole('radio', { name: 'Approve' })).toHaveCount(0);
});

test('asking for changes needs a comment; a milestone no longer ready shows the 409 message', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { conflictNextDecision: true });
  await page.goto(`/${ORG}/portal/projects/${PROJECT_ID}`);
  const ready = page.getByTestId('portal-milestone').filter({ hasText: 'Ground floor handover' });
  await ready.getByRole('radio', { name: 'Request changes' }).click();
  await ready.getByRole('button', { name: 'Send change request' }).click();
  await expect(ready.getByText('Say what needs to change so the team can act on it.')).toBeVisible();
  expect(s.decisions).toHaveLength(0);

  await ready.getByRole('textbox').fill('Move the socket by the door.');
  await ready.getByRole('button', { name: 'Send change request' }).click();
  await expect(ready.getByRole('alert')).toContainText('This milestone is no longer waiting for your review');
  // The list refreshed: another client approved it, so the form is gone.
  await expect(ready).toContainText('Approved');
  await expect(ready.getByRole('radio', { name: 'Request changes' })).toHaveCount(0);
});

test('invoices not yet connected read as a placeholder, files carry signed links', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/portal/projects/${PROJECT_ID}?tab=invoices`);
  await expect(page.getByRole('heading', { name: 'Invoices will appear here' })).toBeVisible();
  await page.getByRole('tab', { name: 'Files' }).click();
  await expect(page.getByRole('link', { name: 'Download site-plan.pdf' })).toHaveAttribute('href', 'https://storage.example.test/signed/site-plan.pdf');
});

test('a client posts on the thread with an idempotency key; no mention list is offered', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/portal/projects/${PROJECT_ID}?tab=messages`);
  await expect(page.getByText('Welcome to the portal. Drawings are under Files.')).toBeVisible();
  const first = page.getByTestId('client-thread').getByRole('listitem').first();
  await expect(first).toContainText('Owner');
  await expect(first).toContainText('Team');
  const editor = page.getByLabel('New message');
  await editor.click();
  await page.keyboard.type('Can we meet on site @Owner on Friday?');
  await expect(page.getByRole('listbox', { name: 'People to mention' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => s.posts.length).toBe(1);
  expect(String(s.posts[0].body.content)).toContain('Can we meet on site @Owner on Friday?');
  expect(s.posts[0].key).toBeTruthy();
  const mine = page.getByTestId('client-thread').getByRole('listitem').last();
  await expect(mine).toContainText('You');
  await expect(mine).toHaveAttribute('data-author-kind', 'client');
  expect(s.thread.at(-1)?.author_id).toBe(CLIENT_ID);
});
