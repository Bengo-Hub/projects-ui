import { expect, test } from '@playwright/test';
import { ORG, freshTenant, json, mockTenantApi, signIn } from './qa-mocks';

// Access follows the projects service profile (GET /{tenant}/auth/me): buttons hide without their
// permission, a permission 403 on a page load lands on the unauthorized page, a subscription 403 on
// a save shows the upgrade message, and a project outside the user's membership reads as not found.

const PROJECT_ID = '66666666-6666-4666-8666-666666666666';
const project = {
  id: PROJECT_ID,
  tenant_id: '55555555-5555-4555-8555-555555555555',
  name: 'Riverside clinic fit-out',
  status: 'active',
  currency: 'KES',
  owner_id: '44444444-4444-4444-8444-444444444444',
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-10T08:00:00Z',
};
const projectsRoute = new RegExp(`/api/v1/${ORG}/projects(\\?.*)?$`);
const page1 = (data: unknown[]) => ({ data, total: data.length, limit: 100, page: 1, hasMore: false });

test('a viewer without projects.projects.add does not see New project', async ({ page, context, baseURL }) => {
  const s = freshTenant({ permissions: ['projects.projects.view'] });
  const user = await signIn(context, baseURL!);
  await mockTenantApi(page, s, user);
  await page.route(projectsRoute, (r) => json(r, page1([project])));
  await page.goto(`/${ORG}/projects`);

  await expect(page.getByRole('heading', { name: 'Riverside clinic fit-out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New project' })).toHaveCount(0);
  // Settings, Roles and access needs projects.rbac.manage.
  await expect(page.getByRole('link', { name: 'Roles and access' })).toHaveCount(0);
});

test('with projects.projects.add the New project button shows', async ({ page, context, baseURL }) => {
  const s = freshTenant({ permissions: ['projects.projects.view', 'projects.projects.add'] });
  const user = await signIn(context, baseURL!);
  await mockTenantApi(page, s, user);
  await page.route(projectsRoute, (r) => json(r, page1([project])));
  await page.goto(`/${ORG}/projects`);
  await expect(page.getByRole('button', { name: 'New project' }).first()).toBeVisible();
});

test('a permission 403 on a page load shows the unauthorized page', async ({ page, context, baseURL }) => {
  const s = freshTenant({ permissions: ['projects.projects.view'] });
  const user = await signIn(context, baseURL!);
  await mockTenantApi(page, s, user);
  await page.route(new RegExp(`/api/v1/${ORG}/projects/${PROJECT_ID}(/summary)?$`), (r) =>
    json(r, { error: 'you do not have permission to perform this action', code: 'permission_denied', required_permission: 'projects.projects.view' }, 403),
  );
  await page.goto(`/${ORG}/projects/${PROJECT_ID}`);

  await expect(page).toHaveURL(new RegExp(`/${ORG}/unauthorized$`));
  await expect(page.getByRole('heading', { name: 'You do not have access to this page' })).toBeVisible();
});

test('a page guard sends a user without the permission to the unauthorized page', async ({ page, context, baseURL }) => {
  const s = freshTenant({ permissions: [] });
  const user = await signIn(context, baseURL!);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/tenders`);
  await expect(page).toHaveURL(new RegExp(`/${ORG}/unauthorized$`));
});

test('a subscription 403 on a save shows the upgrade message, not the unauthorized page', async ({ page, context, baseURL }) => {
  const s = freshTenant({ permissions: ['projects.projects.view', 'projects.projects.add'] });
  const user = await signIn(context, baseURL!);
  await mockTenantApi(page, s, user);
  await page.route(projectsRoute, (r) =>
    r.request().method() === 'POST'
      ? json(r, { error: 'Your subscription is not active. Please renew to continue.', code: 'subscription_inactive', upgrade: true }, 403)
      : json(r, page1([project])),
  );
  await page.goto(`/${ORG}/projects`);

  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel(/^Name/).fill('Warehouse racking');
  await page.getByRole('button', { name: 'Create project' }).click();

  await expect(page.getByText('Your subscription is not active. Renew it to keep saving changes.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'See plans' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${ORG}/projects$`));
});

test('a project outside the membership reads as not found', async ({ page, context, baseURL }) => {
  const s = freshTenant({ permissions: ['projects.projects.view'] });
  const user = await signIn(context, baseURL!);
  await mockTenantApi(page, s, user);
  await page.route(new RegExp(`/api/v1/${ORG}/projects/${PROJECT_ID}(/summary)?$`), (r) => json(r, { error: 'project not found' }, 404));
  await page.goto(`/${ORG}/projects/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Project not found' })).toBeVisible();
});
