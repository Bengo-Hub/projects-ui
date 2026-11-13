import { expect, test } from '@playwright/test';
import { C1, C2, CODE, freshInvitee, mockInviteeApi } from './qa-mocks';

// The public invitee flow at /qa/{code}: email code access, the tester checklist with autosave and
// an offline-safe draft, the signer view, and sign out.

test('an unknown link says it is not open', async ({ page }) => {
  await mockInviteeApi(page, freshInvitee());
  await page.goto('/qa/nope1234');
  await expect(page.getByRole('heading', { name: 'This link is not open' })).toBeVisible();
});

test('a tester gets in with an email code and their verdicts save on their own', async ({ page }) => {
  const s = freshInvitee();
  await mockInviteeApi(page, s);
  await page.goto(`/qa/${CODE}`);

  await page.getByLabel('Email address').fill('tester@acme.test');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'a 6 digit code is on its way' })).toBeVisible();
  expect(s.otpSends).toBe(1);

  await page.getByLabel('Code').fill('999999');
  await page.getByRole('button', { name: 'Open the session' }).click();
  await expect(page.getByText('That code is not right.')).toBeVisible();

  await page.getByLabel('Code').fill('123456');
  await page.getByRole('button', { name: 'Open the session' }).click();
  await expect(page.getByRole('heading', { name: 'Hadia acceptance' })).toBeVisible();
  await expect(page.getByText('0 of 2 checked')).toBeVisible();

  // Pass saves after a short pause with no save button.
  await page.getByText('Pass', { exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect(s.puts[0]).toMatchObject({ criterionId: C1, body: { result: 'pass', severity: null } });
  await expect(page.getByText('1 of 2 checked')).toBeVisible();

  // A failure waits for its severity.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Fail', { exact: true }).click();
  await expect(page.getByText('A failure needs a severity.')).toBeVisible();
  expect(s.puts).toHaveLength(1);
  await page.getByLabel('Severity').selectOption('2');
  await page.getByLabel(/Notes/).fill('The list is empty');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect(s.puts.at(-1)).toMatchObject({ criterionId: C2, body: { result: 'fail', severity: 2, notes: 'The list is empty' } });
});

test('a verdict made offline stays on the device and is sent again', async ({ page }) => {
  const s = freshInvitee({ signedIn: true, failNextPut: true });
  await mockInviteeApi(page, s);
  await page.goto(`/qa/${CODE}`);
  await page.getByText('Blocked', { exact: true }).click();
  await expect(page.getByText(/Kept on this device/)).toBeVisible();
  expect(s.puts).toHaveLength(0);

  // A reload keeps the draft; the next attempt reaches the API.
  await page.reload();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect(s.puts[0]).toMatchObject({ criterionId: C1, body: { result: 'blocked' } });
});

test('the whole list layout shows every criterion', async ({ page }) => {
  await mockInviteeApi(page, freshInvitee({ signedIn: true }));
  await page.goto(`/qa/${CODE}`);
  await page.getByRole('button', { name: 'Whole list' }).click();
  await expect(page.getByRole('heading', { name: 'Owner can create a registry' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guest sees the gift list' })).toBeVisible();
});

test('a signer sees the outcome and opens the report to print', async ({ page }) => {
  await mockInviteeApi(page, freshInvitee({ signedIn: true, role: 'signer', status: 'closed' }));
  await page.goto(`/qa/${CODE}`);
  await expect(page.getByText('How to sign')).toBeVisible();
  await expect(page.getByText('The pass rule is not met')).toBeVisible();
  await expect(page.getByText('60%')).toBeVisible();
  // A signer records no verdicts: the verdict buttons are not there.
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open the report to print' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('sign out returns to the access page', async ({ page }) => {
  const s = freshInvitee({ signedIn: true });
  await mockInviteeApi(page, s);
  await page.goto(`/qa/${CODE}`);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible();
  expect(s.signedIn).toBe(false);
});
