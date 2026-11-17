import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ORG, freshTenant, mockTenantApi, signIn } from './qa-mocks';
import { PROJECT_ID, T1, WORK_PERMISSIONS, freshWork, mockWorkApi } from './work-mocks';
import { CONTACT_ID, PORTAL_STAFF_PERMISSIONS, freshTeamPortal, mockTeamPortalApi } from './portal-mocks';

// Sprint 14, the team's side of the client portal: invite from the CRM, share tasks and files,
// and the client thread. Phone (390 px) and desktop, every API call mocked.

async function setup(page: Page, context: BrowserContext, baseURL: string, permissions = [...WORK_PERMISSIONS, ...PORTAL_STAFF_PERMISSIONS]) {
  const user = await signIn(context, baseURL);
  await mockTenantApi(page, freshTenant({ permissions }), user);
  const w = freshWork();
  await mockWorkApi(page, w);
  const s = freshTeamPortal();
  await mockTeamPortalApi(page, s, w);
  return s;
}

test('a project manager invites a client from a CRM contact and removes one after a confirm', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}`);
  await page.getByRole('link', { name: 'Clients' }).click();
  await expect(page.getByRole('heading', { name: 'Clients (1)' })).toBeVisible();
  // The list renders as cards on a phone and a table on desktop; only one of them is visible.
  await expect(page.getByText('Jane Client').filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Choose a contact/ }).click();
  await page.getByRole('button', { name: /Peter Patron/ }).click();
  await page.getByRole('button', { name: 'Send invite' }).click();
  await expect.poll(() => s.invites.length).toBe(1);
  expect(s.invites[0]).toEqual({ crm_contact_id: CONTACT_ID });
  await expect(page.getByText(/Peter Patron is invited/)).toBeVisible();

  await page.getByRole('button', { name: 'Remove Jane Client' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('loses portal access');
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect.poll(() => s.revoked).toEqual(['cl1']);
});

test('without projects.portal.manage there is no Clients tab and no sharing switch', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, WORK_PERMISSIONS);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}`);
  await expect(page.getByRole('link', { name: 'Tasks' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clients' })).toHaveCount(0);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/tasks?task=${T1}`);
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pour foundation slab' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Visible to client' })).toHaveCount(0);
});

test('the task drawer and the files page share with the client', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/tasks?task=${T1}`);
  const toggle = page.getByRole('dialog').getByRole('switch', { name: 'Visible to client' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect.poll(() => s.taskShares).toEqual([{ taskId: T1, body: { client_visible: true } }]);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await page.goto(`/${ORG}/projects/${PROJECT_ID}/files`);
  await page.getByRole('switch', { name: 'Visible to client: site-plan.pdf' }).first().click();
  await expect.poll(() => s.fileShares).toEqual([{ fileId: 'pf1', body: { client_visible: true } }]);
});

test('the team posts on the client thread, apart from task comments', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/client-thread`);
  await expect(page.getByText('Clients read everything posted on this page.')).toBeVisible();
  await expect(page.getByText('When is the handover?')).toBeVisible();
  const fromClient = page.getByTestId('client-thread').getByRole('listitem').first();
  await expect(fromClient).toContainText('Jane Client');
  await expect(fromClient).toContainText('Client');
  await expect(fromClient).toHaveAttribute('data-author-kind', 'client');
  await page.getByLabel('New message').click();
  await page.keyboard.type('Handover is on the 30th.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => s.posts.length).toBe(1);
  expect(String(s.posts[0].body.content)).toContain('Handover is on the 30th.');
  expect(s.posts[0].key).toBeTruthy();
  await expect(page.getByTestId('client-thread')).toContainText('Handover is on the 30th.');
  const mine = page.getByTestId('client-thread').getByRole('listitem').last();
  await expect(mine).toContainText('Team');
  await expect(mine).toHaveAttribute('data-author-kind', 'team');
});

test("the milestones page shows the client's last decision and change request in place", async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, [...WORK_PERMISSIONS, ...PORTAL_STAFF_PERMISSIONS, 'projects.milestones.view']);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/milestones`);
  const notes = page.getByTestId('milestone-decision');
  await expect(notes).toHaveCount(2);
  await expect(notes.filter({ hasText: 'Changes requested by Jane Client' })).toContainText('Move the socket by the door.');
  await expect(notes.filter({ hasText: 'Approved by Jane Client' })).toContainText('Looks right.');
});
