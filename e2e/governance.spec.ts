import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ORG, freshTenant, mockTenantApi, signIn, STAFF_FEATURES } from './qa-mocks';
import { PROJECT_ID, WORK_PERMISSIONS, freshWork, mockWorkApi } from './work-mocks';
import { D_PROPOSED, REPORTS_MANAGE, REPORTS_VIEW, freshGovernance, mockGovernanceApi, type GovernanceState } from './reports-mocks';

// Sprint 7 governance (US-7.1) at phone (390 px) and desktop widths, every API call mocked: the
// governance seats, the RACI matrix and the decision log.

async function setup(page: Page, context: BrowserContext, baseURL: string, opts: { permissions?: string[]; gov?: Partial<GovernanceState> } = {}) {
  const user = await signIn(context, baseURL, STAFF_FEATURES);
  const tenant = freshTenant({ permissions: opts.permissions ?? [...WORK_PERMISSIONS, ...REPORTS_MANAGE] });
  await mockTenantApi(page, tenant, user);
  await mockWorkApi(page, freshWork());
  const s = freshGovernance(opts.gov);
  await mockGovernanceApi(page, s);
  return s;
}

const url = `/${ORG}/projects/${PROJECT_ID}/governance`;

test('the seats list a teammate and an outside person, and a manager adds an outside seat', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(url);
  const seats = page.getByTestId('governance-seat');
  await expect(seats).toHaveCount(2);
  await expect(seats.filter({ hasText: 'Jane Board' })).toContainText('Riverside Health');
  await page.getByRole('button', { name: 'Add seat' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Someone outside' }).click();
  await dialog.getByRole('textbox', { name: "Person's name" }).fill('Dr Wanjiku');
  await dialog.getByRole('textbox', { name: 'Organisation' }).fill('County health office');
  await dialog.getByRole('button', { name: 'Add seat' }).click();
  await expect.poll(() => s.rolePosts.length).toBe(1);
  expect(s.rolePosts[0]).toMatchObject({ role: 'sponsor', person_name: 'Dr Wanjiku', organisation: 'County health office' });
  expect(s.rolePosts[0].user_id).toBeUndefined();
  await expect(page.getByTestId('governance-seat')).toHaveCount(3);
});

test('the RACI matrix shows cards on a phone and a table on a desktop, and an incomplete row is refused', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(url);
  await page.getByRole('tab', { name: 'RACI matrix' }).click();
  const phone = (page.viewportSize()?.width ?? 1280) < 640;
  if (phone) {
    await expect(page.getByTestId('raci-card').filter({ hasText: 'Approve the design' })).toBeVisible();
    await expect(page.getByTestId('raci-table')).toBeHidden();
  } else {
    await expect(page.getByTestId('raci-table')).toContainText('Approve the design');
    await expect(page.getByTestId('raci-cards')).toBeHidden();
  }
  await page.getByRole('button', { name: 'Add activity' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Activity' }).fill('Sign the handover');
  await dialog.getByRole('button', { name: 'Add row' }).click();
  await expect(dialog.getByTestId('raci-error')).toBeVisible();
  expect(s.raciPosts).toHaveLength(0);
});

test('an approver rejects a decision with a reason', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(url);
  await page.getByRole('tab', { name: 'Decision log' }).click();
  const proposed = page.getByTestId('decision').filter({ hasText: 'Switch to precast slabs' });
  await expect(proposed.getByTestId('decision-status')).toHaveText('Waiting for approval');
  await proposed.getByRole('button', { name: 'Reject' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Reject decision' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(s.decides).toHaveLength(0);
  await dialog.getByRole('textbox', { name: 'Comment' }).fill('The plant reopens next week.');
  await dialog.getByRole('button', { name: 'Reject decision' }).click();
  await expect.poll(() => s.decides.length).toBe(1);
  expect(s.decides[0]).toEqual({ id: D_PROPOSED, body: { decision: 'reject', comment: 'The plant reopens next week.' } });
  await expect(proposed.getByTestId('decision-status')).toHaveText('Rejected');
});

test('a manager logs a decision without approvers', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(url);
  await page.getByRole('tab', { name: 'Decision log' }).click();
  await page.getByRole('button', { name: 'Log a decision' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Decision title' }).fill('Work Saturdays in December');
  await expect(dialog).toContainText('Without approvers the decision is recorded as approved.');
  await dialog.getByRole('button', { name: 'Log decision' }).click();
  await expect.poll(() => s.decisionPosts.length).toBe(1);
  expect(s.decisionPosts[0]).toMatchObject({ title: 'Work Saturdays in December' });
  const logged = page.getByTestId('decision').filter({ hasText: 'Work Saturdays in December' });
  await expect(logged.getByTestId('decision-status')).toHaveText('Approved');
});

test('a reader sees governance but no edit buttons', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...REPORTS_VIEW] });
  await page.goto(url);
  await expect(page.getByTestId('governance-seat')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Add seat' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Decision log' }).click();
  await expect(page.getByTestId('decision')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Log a decision' })).toHaveCount(0);
});
