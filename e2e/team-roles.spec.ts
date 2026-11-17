import { expect, test, type Locator, type Page } from '@playwright/test';
import { ORG, json } from './qa-mocks';
import { ANA, BEN, ME, PROJECT_ID, setupAccess } from './access-mocks';

// Team and roles (sprint 17) at phone and desktop widths: invite, a role with an end date,
// deactivation, custom roles, copy on write of a default role, a held role that cannot be deleted,
// codes held through manage locked in the editor, the project team's people picker, sign out
// revoking the SSO session, the callback's state check and the <Can> guard. After the sprint: the
// person screen (roles, status, effective permissions, the Team actions and guards) and the tender
// committee people picker and the named committee list.

/** Opens a shared combobox by its current text and picks the option whose name starts with option. */
async function pick(scope: Page | Locator, trigger: string | RegExp, option: string) {
  await scope.getByRole('button', { name: trigger, exact: true }).filter({ visible: true }).first().click();
  await scope.getByRole('button', { name: new RegExp(`^${option}`) }).filter({ visible: true }).last().click();
}

const visible = (scope: Page | Locator, text: string | RegExp) => scope.getByText(text).filter({ visible: true }).first();

test('the team page invites a person by email with a role', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/team`);
  await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
  await expect(visible(page, 'Ana Wanjiru')).toBeVisible();

  await page.getByRole('button', { name: 'Invite person' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill('cara@acme.test');
  await pick(dialog, 'Member', 'Viewer');
  await dialog.getByRole('button', { name: 'Send invite' }).click();

  await expect(page.getByText('Invitation sent to cara@acme.test')).toBeVisible();
  expect(s.invites).toEqual([{ email: 'cara@acme.test', role_code: 'viewer' }]);
});

test('a role is given with an end date', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/team`);
  await page.getByRole('button', { name: 'Roles of Ana Wanjiru' }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('From their organisation role, until you give them one')).toBeVisible();

  await pick(dialog, 'Choose a role', 'Viewer');
  await dialog.getByLabel('End date').fill('2099-01-31');
  await dialog.getByRole('button', { name: 'Give role' }).click();

  await expect(page.getByText('Viewer role given')).toBeVisible();
  expect(s.assigns).toHaveLength(1);
  expect(s.assigns[0].userId).toBe(ANA);
  expect(s.assigns[0].body.role_code).toBe('viewer');
  // The end of the chosen day in the browser's zone, sent as an ISO time.
  expect(s.assigns[0].body.expires_at).toMatch(/^2099-0[12]-\d\dT/);
  // The dialog follows the live row: the new role shows with its end date.
  await expect(dialog.getByText(/^Until /)).toBeVisible();
});

test('a person is deactivated after confirming', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/team`);
  await page.getByRole('button', { name: 'Deactivate Ben Otieno' }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Ben Otieno keeps their roles but can do nothing in projects until reactivated.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Deactivate' }).click();

  await expect(page.getByText('Person deactivated')).toBeVisible();
  expect(s.statuses).toEqual([{ userId: BEN, status: 'inactive' }]);
  await expect(page.getByRole('button', { name: 'Reactivate Ben Otieno' }).filter({ visible: true }).first()).toBeVisible();
  // Nobody acts on their own access.
  await expect(page.getByRole('button', { name: 'Deactivate Owner' })).toHaveCount(0);
});

test('without admin tier the team page offers no invite and no deactivation', async ({ page, context, baseURL }) => {
  await setupAccess(page, context, baseURL!, { permissions: ['projects.rbac.manage', 'projects.projects.view'], roles: ['team_lead'] });
  await page.goto(`/${ORG}/settings/team`);
  await expect(visible(page, 'Ana Wanjiru')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invite person' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Deactivate / })).toHaveCount(0);
});

test('roles: create, copy, and a held role cannot be deleted', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/roles`);
  await expect(page.getByRole('heading', { name: 'Roles and access' })).toBeVisible();

  await page.getByRole('button', { name: 'New role' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Site supervisor');
  await dialog.getByRole('button', { name: 'Create role' }).click();
  await expect(page.getByText('Role created. Choose what it can do.')).toBeVisible();
  expect(s.created).toEqual([{ name: 'Site supervisor', permission_codes: [] }]);
  await expect(page.getByRole('list', { name: 'Roles' }).getByText('Site supervisor')).toBeVisible();

  await page.getByRole('button', { name: 'Copy Project manager' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Name')).toHaveValue('Project manager copy');
  await dialog.getByRole('button', { name: 'Copy role' }).click();
  await expect(page.getByText('Role copied')).toBeVisible();
  expect(s.clones).toHaveLength(1);
  expect(s.clones[0].name).toBe('Project manager copy');

  // Site lead is held by one person: the API refuses and the reason shows.
  await page.getByRole('button', { name: 'Delete Site lead' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete role' }).click();
  await expect(page.getByText('people still hold this role; move them to another role first')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Roles' }).getByText('Site lead', { exact: true })).toBeVisible();
  // Default and read only roles offer no delete.
  await expect(page.getByRole('button', { name: 'Delete Member' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy Client' })).toHaveCount(0);
});

test('editing a default role saves the firm its own copy', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/roles`);
  await page.getByRole('list', { name: 'Roles' }).getByRole('button', { name: /^Member/ }).click();
  await expect(page.getByText('This is a default role.', { exact: false })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Delete tasks' }).check();
  await page.getByRole('button', { name: 'Save permissions' }).click();

  await expect(page.getByText('Saved as your own copy of this default role')).toBeVisible();
  expect(s.permissionPuts).toHaveLength(1);
  expect(s.permissionPuts[0].roleId).toBe('00000000-0000-4000-8000-000000000003');
  expect(s.permissionPuts[0].codes).toContain('projects.tasks.delete');
  const memberRow = page.getByRole('list', { name: 'Roles' }).getByRole('button', { name: /^Member/ });
  await expect(memberRow.getByText('Customised')).toBeVisible();
});

test('codes held through manage are ticked and locked; the reserved roles are read only', async ({ page, context, baseURL }) => {
  await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/roles`);
  await page.getByRole('list', { name: 'Roles' }).getByRole('button', { name: /^Project manager/ }).click();

  // The label carries the lock: "View tasks via manage".
  const viewTasks = page.getByRole('checkbox', { name: 'View tasks via manage', exact: true });
  await expect(viewTasks).toBeChecked();
  await expect(viewTasks).toBeDisabled();
  await expect(visible(page, 'via manage')).toBeVisible();
  await expect(page.getByText('Manage every project', { exact: true })).toBeVisible();

  await page.getByRole('list', { name: 'Roles' }).getByRole('button', { name: /^Projects administrator/ }).click();
  await expect(page.getByText('The projects administrator role is read only: it always holds every permission.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save permissions' })).toHaveCount(0);
});

test('the project team adds a member picked by name, with a project role the API accepts', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!, {
    permissions: ['projects.projects.view', 'projects.members.view', 'projects.members.manage'],
    roles: ['project_manager'],
  });
  const membersRoute = new RegExp(`/api/v1/${ORG}/projects/${PROJECT_ID}/members(\\?.*)?$`);
  await page.route(membersRoute, (r) => {
    if (r.request().method() === 'POST') {
      const b = r.request().postDataJSON() as { user_id: string; role_code: string };
      s.memberAdds.push(b);
      return json(r, { id: 'm2', project_id: PROJECT_ID, user_id: b.user_id, role_code: b.role_code, joined_at: '2026-11-17T08:00:00Z' }, 201);
    }
    return json(r, {
      data: [{ id: 'm1', project_id: PROJECT_ID, user_id: ANA, role_code: 'member', name: 'Ana Wanjiru', email: 'ana@acme.test', joined_at: '2026-11-01T08:00:00Z' }],
      total: 1, limit: 500, page: 1, hasMore: false,
    });
  });
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/team`);
  await page.getByRole('button', { name: 'Add member' }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('User ID')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Choose a person', exact: true }).click();
  // Ana is already on the team, so only Ben is offered.
  await expect(page.getByRole('button', { name: /^Ana Wanjiru/ }).filter({ visible: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Ben Otieno/ }).filter({ visible: true }).last().click();
  await pick(dialog, 'Member', 'Manager');
  await dialog.getByRole('button', { name: 'Add member' }).click();

  await expect.poll(() => s.memberAdds).toEqual([{ user_id: BEN, role_code: 'manager' }]);
});

test('sign out revokes the SSO session and returns to the firm', async ({ page, context, baseURL }) => {
  await setupAccess(page, context, baseURL!);
  const revokes: string[] = [];
  await page.route(/\/api\/v1\/auth\/logout(\?.*)?$/, (r) => {
    if (r.request().method() === 'POST') {
      revokes.push(r.request().headers()['authorization'] ?? '');
      return r.fulfill({ status: 204 });
    }
    // auth-api's GET logout redirects back to the post-logout address.
    const back = new URL(r.request().url()).searchParams.get('post_logout_redirect_uri') ?? '/';
    return r.fulfill({ status: 302, headers: { location: back } });
  });
  await page.goto(`/${ORG}/dashboard`);
  await page.getByRole('button', { name: 'Open profile menu' }).click();
  const logoutNav = page.waitForRequest((req) => req.method() === 'GET' && /\/api\/v1\/auth\/logout/.test(req.url()));
  await page.getByRole('button', { name: 'Sign out' }).click();
  const nav = await logoutNav;

  expect(revokes).toHaveLength(1);
  expect(revokes[0]).toMatch(/^Bearer /);
  expect(new URL(nav.url()).searchParams.get('post_logout_redirect_uri')).toBe(`${new URL(baseURL!).origin}/${ORG}`);
});

test('a callback whose state does not match shows the shared sign-in error and no exchange', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await context.addInitScript((o) => {
    if (window.location.origin === o) {
      window.sessionStorage.setItem('pkce_state', 'expected-state');
      window.sessionStorage.setItem('pkce_verifier', 'verifier');
    }
  }, origin);
  let exchanges = 0;
  await page.route(/\/api\/v1\/token$/, (r) => {
    exchanges++;
    return json(r, { error: 'should not be called' }, 400);
  });
  await page.goto(`/${ORG}/auth/callback?code=abc&state=forged-state`);
  await expect(page.getByRole('heading', { name: 'Sign-in failed' })).toBeVisible();
  await expect(page.getByText('Sign-in session mismatch. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in again' })).toBeVisible();
  expect(exchanges).toBe(0);
});

test('<Can> shows Save as template only with projects.templates.add', async ({ page, context, baseURL }) => {
  const project = {
    id: PROJECT_ID, tenant_id: '55555555-5555-4555-8555-555555555555', name: 'Riverside clinic fit-out', status: 'active',
    currency: 'KES', owner_id: '44444444-4444-4444-8444-444444444444', created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-10T08:00:00Z',
  };
  for (const [perms, count] of [[['projects.projects.view'], 0], [['projects.projects.view', 'projects.templates.add'], 1]] as const) {
    const fresh = await context.newPage();
    await setupAccess(fresh, context, baseURL!, { permissions: [...perms], roles: ['member'] });
    await fresh.route(new RegExp(`/api/v1/${ORG}/projects/${PROJECT_ID}(/summary)?$`), (r) => json(r, project));
    await fresh.goto(`/${ORG}/projects/${PROJECT_ID}`);
    await expect(fresh.getByRole('heading', { name: 'Riverside clinic fit-out' })).toBeVisible();
    await expect(fresh.getByRole('button', { name: 'Save as template' })).toHaveCount(count);
    await fresh.close();
  }
});

test('Team sits next to Roles and access in the menu for role managers only', async ({ page, context, baseURL }, testInfo) => {
  await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/dashboard`);
  if (testInfo.project.name === 'phone') {
    await page.getByTestId('mobile-bottom-nav').locator('nav').getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Team', exact: true })).toBeVisible();
  } else {
    await expect(page.getByTestId('desktop-sidebar').getByRole('link', { name: 'Team', exact: true })).toBeVisible();
  }
});

test('a person opens from the Team page with roles, status, last seen and effective permissions by module', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/team`);
  await page.getByRole('link', { name: 'Open Ben Otieno' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/${ORG}/settings/team/${BEN}$`));
  await expect(page.getByRole('heading', { name: 'Ben Otieno' })).toBeVisible();
  expect(s.userReads).toContain(BEN);

  const roles = page.getByRole('list', { name: 'Roles held' });
  await expect(roles.getByText('Site lead')).toBeVisible();
  await expect(roles.getByText('No end date')).toBeVisible();
  const facts = page.getByTestId('person-facts');
  await expect(facts.getByText('Active', { exact: true })).toBeVisible();
  await expect(facts.getByText('Not yet')).toBeVisible();

  // Site lead holds projects.projects.view and projects.tasks.view: one group per module.
  const perms = page.getByTestId('effective-permissions');
  await expect(perms.getByRole('region', { name: 'Projects' }).getByText('View projects')).toBeVisible();
  await expect(perms.getByRole('region', { name: 'Tasks' }).getByText('View tasks')).toBeVisible();
  await expect(perms.getByText('Delete tasks')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Team' }).first()).toHaveAttribute('href', `/${ORG}/settings/team`);
});

test('the person screen deactivates after confirming and then shows no permissions', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/team/${BEN}`);
  await page.getByRole('button', { name: 'Deactivate Ben Otieno' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Ben Otieno keeps their roles but can do nothing in projects until reactivated.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Deactivate' }).click();

  await expect(page.getByText('Person deactivated')).toBeVisible();
  expect(s.statuses).toEqual([{ userId: BEN, status: 'inactive' }]);
  await expect(page.getByTestId('person-facts').getByText('Deactivated', { exact: true })).toBeVisible();
  await expect(page.getByTestId('person-facts').getByText('None while deactivated')).toBeVisible();
  await expect(page.getByText('Nothing while deactivated.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reactivate Ben Otieno' })).toBeVisible();
});

test('the person screen gives a role with an end date through the same dialog as Team', async ({ page, context, baseURL }) => {
  const { s } = await setupAccess(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/team/${ANA}`);
  await expect(page.getByRole('list', { name: 'Roles held' }).getByText('Automatic, from their organisation role')).toBeVisible();
  await page.getByRole('button', { name: 'Roles of Ana Wanjiru' }).click();
  const dialog = page.getByRole('dialog');
  await pick(dialog, 'Choose a role', 'Viewer');
  await dialog.getByLabel('End date').fill('2099-01-31');
  await dialog.getByRole('button', { name: 'Give role' }).click();

  await expect(page.getByText('Viewer role given')).toBeVisible();
  expect(s.assigns.map((a) => [a.userId, a.body.role_code])).toEqual([[ANA, 'viewer']]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('list', { name: 'Roles held' }).getByText(/^Until /)).toBeVisible();
});

test('the person screen follows the Team guards: no status change without admin tier, no actions on yourself', async ({ page, context, baseURL }) => {
  await setupAccess(page, context, baseURL!, { permissions: ['projects.rbac.manage', 'projects.projects.view'], roles: ['team_lead'] });
  await page.goto(`/${ORG}/settings/team/${BEN}`);
  await expect(page.getByRole('heading', { name: 'Ben Otieno' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roles of Ben Otieno' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Deactivate|Reactivate) / })).toHaveCount(0);

  await page.goto(`/${ORG}/settings/team/${ME}`);
  await expect(page.getByRole('heading', { name: 'Owner' })).toBeVisible();
  await expect(page.getByText('This is you. Another administrator changes your access.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Roles of / })).toHaveCount(0);
});

test('a tender committee adds a member picked by name with tenders.manage only', async ({ page, context, baseURL }) => {
  await setupAccess(page, context, baseURL!, {
    permissions: ['projects.tenders.view', 'projects.tenders.manage'],
    roles: ['bid_manager'],
  });
  const TENDER = '77777777-7777-4777-8777-777777777777';
  const COMMITTEE = '88888888-8888-4888-8888-888888888888';
  const adds: { user_id: string; role: string }[] = [];
  await page.route(new RegExp(`/api/v1/${ORG}/tenders/${TENDER}/committees(\\?.*)?$`), (r) =>
    json(r, {
      data: [{
        id: COMMITTEE, tender_id: TENDER, tenant_id: '55555555-5555-4555-8555-555555555555', name: 'Evaluation panel', created_at: '2026-11-01T08:00:00Z',
        edges: { members: [{ id: 'cm1', committee_id: COMMITTEE, user_id: ANA, role: 'chair', joined_at: '2026-11-01T08:00:00Z' }] },
      }],
      total: 1, limit: 20, page: 1, hasMore: false,
    }),
  );
  await page.route(new RegExp(`/api/v1/${ORG}/tenders/${TENDER}/committees/${COMMITTEE}/members$`), (r) => {
    adds.push(r.request().postDataJSON() as { user_id: string; role: string });
    return json(r, { id: 'cm2', committee_id: COMMITTEE, user_id: BEN, role: 'member' }, 201);
  });
  await page.goto(`/${ORG}/tenders/${TENDER}/committees`);
  const card = page.getByTestId('committee-card');
  // The member row reads as a name, not a raw id, and there is no id box.
  await expect(card.getByText('Ana Wanjiru')).toBeVisible();
  await expect(page.getByLabel('User ID')).toHaveCount(0);

  await card.getByRole('button', { name: 'Choose a person', exact: true }).click();
  // Ana already sits on the committee, so only Ben is offered.
  await expect(page.getByRole('button', { name: /^Ana Wanjiru/ }).filter({ visible: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Ben Otieno/ }).filter({ visible: true }).last().click();
  await card.getByRole('button', { name: 'Add to Evaluation panel' }).click();

  await expect.poll(() => adds).toEqual([{ user_id: BEN, role: 'member' }]);
});

test('a tender viewer sees committee members by the names the list carries, with no people search', async ({ page, context, baseURL }) => {
  await setupAccess(page, context, baseURL!, { permissions: ['projects.tenders.view'], roles: ['viewer'] });
  const TENDER = '77777777-7777-4777-8777-777777777777';
  const COMMITTEE = '88888888-8888-4888-8888-888888888888';
  let peopleCalls = 0;
  await page.route(new RegExp(`/api/v1/${ORG}/people(\\?.*)?$`), (r) => {
    peopleCalls++;
    return json(r, { error: 'forbidden' }, 403);
  });
  await page.route(new RegExp(`/api/v1/${ORG}/tenders/${TENDER}/committees(\\?.*)?$`), (r) =>
    json(r, {
      data: [{
        id: COMMITTEE, tender_id: TENDER, tenant_id: '55555555-5555-4555-8555-555555555555', name: 'Evaluation panel', created_at: '2026-11-01T08:00:00Z',
        edges: { members: [
          { id: 'cm1', committee_id: COMMITTEE, user_id: ANA, role: 'chair', joined_at: '2026-11-01T08:00:00Z', user_name: 'Ana Wanjiru', email: 'ana@acme.test' },
          { id: 'cm2', committee_id: COMMITTEE, user_id: BEN, role: 'member', joined_at: '2026-11-01T08:00:00Z', user_name: '', email: 'ben@acme.test' },
        ] },
      }],
    }),
  );
  await page.goto(`/${ORG}/tenders/${TENDER}/committees`);
  const card = page.getByTestId('committee-card');
  await expect(card.getByText('Ana Wanjiru')).toBeVisible();
  await expect(card.getByText('ana@acme.test')).toBeVisible();
  // No name on file: the email stands in, never the raw id.
  await expect(card.getByText('ben@acme.test')).toBeVisible();
  await expect(card.getByText(ANA)).toHaveCount(0);
  await expect(card.getByText(BEN)).toHaveCount(0);
  // A viewer gets no picker and makes no people search.
  await expect(card.getByRole('button', { name: 'Choose a person', exact: true })).toHaveCount(0);
  expect(peopleCalls).toBe(0);
});
