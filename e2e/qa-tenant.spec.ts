import { expect, test } from '@playwright/test';
import { C2, ORG, SESSION_ID, TEMPLATE_ID, freshTenant, mockTenantApi, signIn } from './qa-mocks';

// The tenant screens: permission gates, the session board, decisions and the template import.

test('without a QA permission the page says so and the menu hides Acceptance', async ({ page, context, baseURL }) => {
  const s = freshTenant({ permissions: [] });
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa`);
  await expect(page.getByText('You do not have access to acceptance testing')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Acceptance', exact: true })).toHaveCount(0);
});

test('a viewer sees sessions without the manage buttons', async ({ page, context, baseURL }) => {
  const s = freshTenant({ permissions: ['projects.qa.view'] });
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa`);
  await expect(page.getByRole('link', { name: 'Hadia acceptance' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'New session' })).toHaveCount(0);
});

test('accept is disabled with the reason while the pass rule fails; reject needs a reason', async ({ page, context, baseURL }) => {
  const s = freshTenant();
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa/sessions/${SESSION_ID}`);

  await expect(page.getByRole('button', { name: 'Accept' })).toBeDisabled();
  await expect(page.getByText(/Accept is not available\. The pass rule is not met: a blocking failure is open/)).toBeVisible();

  await page.getByRole('button', { name: 'Reject' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Reject' })).toBeDisabled();
  await dialog.getByLabel(/Reason/).fill('Severity 2 failure on the guest list');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect.poll(() => s.decisions).toEqual([{ decision: 'rejected', reason: 'Severity 2 failure on the guest list' }]);
});

test('accept works once the pass rule is met', async ({ page, context, baseURL }) => {
  const s = freshTenant({ accepted: true });
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa/sessions/${SESSION_ID}`);
  await page.getByRole('button', { name: 'Accept' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Accept' }).click();
  await expect.poll(() => s.decisions[0]?.decision).toBe('accepted');
});

test('a failed ticket can be retried from the defects tab', async ({ page, context, baseURL }) => {
  const s = freshTenant();
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa/sessions/${SESSION_ID}`);
  await page.getByRole('tab', { name: /Defects/ }).click();
  await expect(page.getByText('Ticket failed')).toBeVisible();
  await page.getByRole('button', { name: 'Retry ticket' }).click();
  await expect.poll(() => s.raised).toEqual([C2]);
});

test('people are invited with a role', async ({ page, context, baseURL }) => {
  const s = freshTenant({ sessionStatus: 'open' });
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa/sessions/${SESSION_ID}`);
  await page.getByRole('tab', { name: /People/ }).click();
  await expect(page.getByText('Signer One')).toBeVisible();
  await page.getByRole('button', { name: 'Invite people' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill('new.signer@acme.test');
  await dialog.getByLabel('Role').selectOption('signer');
  await dialog.getByRole('button', { name: 'Send invitations' }).click();
  await expect.poll(() => s.invites).toEqual([{ email: 'new.signer@acme.test', name: '', role: 'signer' }]);
});

test('the report opens in the preview', async ({ page, context, baseURL }) => {
  const s = freshTenant();
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa/sessions/${SESSION_ID}`);
  await page.getByRole('button', { name: 'Report PDF' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('criteria import is checked before anything is sent', async ({ page, context, baseURL }) => {
  const s = freshTenant();
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa/templates/${TEMPLATE_ID}`);
  await page.getByRole('button', { name: 'Import' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Or paste the criteria').fill('title,weight\nFirst,must\n,should');
  await dialog.getByRole('button', { name: 'Check rows' }).click();
  await expect(dialog.getByText('Row 2: a title is required.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Import/ })).toBeDisabled();

  await dialog.getByLabel('Or paste the criteria').fill('title,weight\nFirst,must\nSecond,could');
  await dialog.getByRole('button', { name: 'Check rows' }).click();
  await dialog.getByRole('button', { name: 'Import 2' }).click();
  await expect.poll(() => s.imported).toBe(2);
});

test('the feature picker falls back to a typed code while the catalogue is off', async ({ page, context, baseURL }) => {
  const s = freshTenant();
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/qa/templates/${TEMPLATE_ID}`);
  await page.getByRole('button', { name: 'Add criterion' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Feature', { exact: true }).check();
  await expect(dialog.getByText('The feature catalogue is not enabled yet.', { exact: false })).toBeVisible();
  await expect(dialog.getByLabel('Feature code')).toBeVisible();
});
