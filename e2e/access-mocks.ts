import type { BrowserContext, Page, Route } from '@playwright/test';
import { ORG, freshTenant, json, mockTenantApi, signIn } from './qa-mocks';

// Team and roles (sprint 17): a stateful mock of projects-api's /rbac routes, the invite and the
// people picker. Routes match by path, whatever API URL the build was made with.

export const ME = '44444444-4444-4444-8444-444444444444';
export const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
export const BEN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
export const CARA = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
export const PROJECT_ID = '66666666-6666-4666-8666-666666666666';

const g = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

export interface MockRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system_role: boolean;
  scope: 'global' | 'tenant';
  is_customized: boolean;
  permissions: string[];
  holders: number;
}

export interface MockAssignment {
  role_id: string;
  role_code: string;
  name: string;
  assigned_at: string;
  expires_at: string | null;
  expired: boolean;
  automatic: boolean;
}

export interface MockUser {
  user_id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  assignments: MockAssignment[];
  last_seen_at?: string;
}

export interface AccessState {
  roles: MockRole[];
  users: MockUser[];
  invites: { email: string; role_code?: string }[];
  assigns: { userId: string; body: { role_code: string; expires_at?: string } }[];
  statuses: { userId: string; status: string }[];
  created: { name: string; permission_codes?: string[] }[];
  clones: { sourceId: string; name: string }[];
  permissionPuts: { roleId: string; codes: string[] }[];
  memberAdds: { user_id: string; role_code: string }[];
  peopleSearches: string[];
  /** GET /rbac/users/{id} calls (the person screen). */
  userReads: string[];
}

const catalogue = [
  ['projects.projects.view', 'View projects'],
  ['projects.projects.add', 'Create projects'],
  ['projects.projects.manage', 'Manage every project in the organisation'],
  ['projects.tasks.view', 'View tasks'],
  ['projects.tasks.view_own', 'View tasks assigned to me'],
  ['projects.tasks.add', 'Create tasks'],
  ['projects.tasks.delete', 'Delete tasks'],
  ['projects.tasks.manage', 'Manage tasks'],
  ['projects.portal.view', 'Use the client portal'],
  ['projects.rbac.manage', 'Manage roles and role assignments'],
].map(([code, name]) => {
  const [, module, action] = code.split('.');
  const implied: string[] = [];
  if (action !== 'manage' && (module === 'projects' || module === 'tasks')) implied.push(`projects.${module}.manage`);
  if (action === 'view_own') implied.push(`projects.${module}.view`);
  return { code, name, module, action, implied_by: implied };
});

function role(n: number, code: string, name: string, permissions: string[], holders: number, scope: 'global' | 'tenant' = 'global'): MockRole {
  return { id: g(n), code, name, is_system_role: scope === 'global', scope, is_customized: false, permissions, holders };
}

function held(r: MockRole, over: Partial<MockAssignment> = {}): MockAssignment {
  return { role_id: r.id, role_code: r.code, name: r.name, assigned_at: '2026-11-01T08:00:00Z', expires_at: null, expired: false, automatic: false, ...over };
}

export function freshAccess(): AccessState {
  const admin = role(1, 'projects_admin', 'Projects administrator', catalogue.map((p) => p.code), 1);
  const pm = role(2, 'project_manager', 'Project manager', ['projects.projects.view', 'projects.tasks.manage'], 0);
  const member = role(3, 'member', 'Member', ['projects.projects.view', 'projects.tasks.view', 'projects.tasks.add'], 1);
  const viewer = role(4, 'viewer', 'Viewer', ['projects.projects.view', 'projects.tasks.view'], 0);
  const client = role(5, 'client', 'Client', ['projects.portal.view'], 0);
  const lead = { ...role(6, 'site_lead', 'Site lead', ['projects.projects.view', 'projects.tasks.view'], 1, 'tenant') };
  return {
    roles: [admin, pm, member, viewer, client, lead],
    users: [
      { user_id: ME, email: 'owner@acme.test', name: 'Owner', status: 'active', roles: ['projects_admin'], assignments: [held(admin, { automatic: true })], last_seen_at: '2026-11-17T08:00:00Z' },
      { user_id: ANA, email: 'ana@acme.test', name: 'Ana Wanjiru', status: 'active', roles: ['member'], assignments: [held(member, { automatic: true })], last_seen_at: '2026-11-16T08:00:00Z' },
      { user_id: BEN, email: 'ben@acme.test', name: 'Ben Otieno', status: 'active', roles: ['site_lead'], assignments: [held(lead)] },
    ],
    invites: [],
    assigns: [],
    statuses: [],
    created: [],
    clones: [],
    permissionPuts: [],
    memberAdds: [],
    peopleSearches: [],
    userReads: [],
  };
}

const page1 = <T,>(data: T[]) => ({ data, total: data.length, limit: 50, page: 1, hasMore: false });

async function rbacRoute(route: Route, s: AccessState) {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname.replace(new RegExp(`^.*/api/v1/${ORG}/rbac`), '');
  const method = req.method();
  const body = () => (req.postDataJSON() ?? {}) as Record<string, unknown>;

  if (path === '/roles' && method === 'GET') return json(route, { data: s.roles });
  if (path === '/permissions') return json(route, { data: catalogue });
  if (path === '/audit-logs') {
    return json(route, page1([{ id: 'a1', actor_user_id: ME, actor_email: 'owner@acme.test', action: 'role.assigned', resource_type: 'user', resource_id: BEN, changes: { name: 'Site lead' }, created_at: '2026-11-16T09:00:00Z' }]));
  }
  if (path === '/roles' && method === 'POST') {
    const b = body() as { name: string; permission_codes?: string[] };
    s.created.push(b);
    const r = role(20 + s.created.length, b.name.toLowerCase().replace(/\W+/g, '_'), b.name, b.permission_codes ?? [], 0, 'tenant');
    s.roles.push(r);
    return json(route, r, 201);
  }
  let m = path.match(/^\/roles\/([^/]+)\/clone$/);
  if (m) {
    const src = s.roles.find((r) => r.id === m![1])!;
    const b = body() as { name: string };
    s.clones.push({ sourceId: src.id, name: b.name });
    const r = role(40 + s.clones.length, b.name.toLowerCase().replace(/\W+/g, '_'), b.name, [...src.permissions], 0, 'tenant');
    s.roles.push(r);
    return json(route, r, 201);
  }
  m = path.match(/^\/roles\/([^/]+)\/permissions$/);
  if (m) {
    const r = s.roles.find((x) => x.id === m![1]);
    if (!r) return json(route, { error: 'role not found' }, 404);
    if (method === 'GET') return json(route, { permission_codes: r.permissions });
    const codes = (body() as { permission_codes: string[] }).permission_codes;
    s.permissionPuts.push({ roleId: r.id, codes });
    if (r.scope === 'global') {
      // Copy on write: the firm's copy replaces the default in the list, with a new id.
      const copy: MockRole = { ...r, id: g(60 + s.permissionPuts.length), scope: 'tenant', is_system_role: false, is_customized: true, permissions: codes };
      s.roles = s.roles.map((x) => (x.id === r.id ? copy : x));
      return json(route, copy);
    }
    r.permissions = codes;
    return json(route, r);
  }
  m = path.match(/^\/roles\/([^/]+)$/);
  if (m && method === 'DELETE') {
    const r = s.roles.find((x) => x.id === m![1]);
    if (!r) return json(route, { error: 'role not found' }, 404);
    if (r.holders > 0) return json(route, { error: 'people still hold this role; move them to another role first' }, 409);
    s.roles = s.roles.filter((x) => x.id !== r.id);
    return route.fulfill({ status: 204 });
  }
  if (path === '/users' && method === 'GET') {
    const q = (url.searchParams.get('search') ?? '').toLowerCase();
    return json(route, page1(s.users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q))));
  }
  m = path.match(/^\/users\/([^/]+)\/roles$/);
  if (m && method === 'POST') {
    const b = body() as { role_code: string; expires_at?: string };
    s.assigns.push({ userId: m[1], body: b });
    const u = s.users.find((x) => x.user_id === m![1])!;
    const r = s.roles.find((x) => x.code === b.role_code)!;
    u.assignments = [...u.assignments.filter((a) => !a.automatic && a.role_code !== r.code), held(r, { expires_at: b.expires_at ?? null })];
    u.roles = u.assignments.map((a) => a.role_code);
    return route.fulfill({ status: 204 });
  }
  m = path.match(/^\/users\/([^/]+)$/);
  if (m && method === 'GET') {
    s.userReads.push(m[1]);
    const u = s.users.find((x) => x.user_id === m![1]);
    if (!u) return json(route, { error: 'user not found' }, 404);
    // Effective permissions: the running roles' codes, none while deactivated.
    const running = u.assignments.filter((a) => !a.expired).map((a) => a.role_code);
    const perms = u.status === 'inactive' ? [] : [...new Set(s.roles.filter((r) => running.includes(r.code)).flatMap((r) => r.permissions))];
    return json(route, { ...u, permissions: perms });
  }
  if (m && method === 'PATCH') {
    const status = (body() as { status: string }).status;
    s.statuses.push({ userId: m[1], status });
    const u = s.users.find((x) => x.user_id === m![1])!;
    u.status = status;
    return json(route, { ...u, permissions: [] });
  }
  return json(route, { error: 'not mocked' }, 404);
}

/** Signs in as a projects administrator (or with perms and roles given) with the access mock on. */
export async function setupAccess(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  opts: { permissions?: string[]; roles?: string[] } = {},
) {
  const s = freshAccess();
  const t = freshTenant({ permissions: opts.permissions ?? catalogue.map((p) => p.code) });
  const user = await signIn(context, baseURL);
  await mockTenantApi(page, t, user);
  await page.route(new RegExp(`/api/v1/${ORG}/auth/me$`), (r) =>
    json(r, {
      user_id: user.id,
      email: user.email,
      name: user.fullName,
      tenant_id: user.tenant_id,
      global_roles: user.roles,
      service_role: (opts.roles ?? ['projects_admin'])[0] ?? '',
      roles: opts.roles ?? ['projects_admin'],
      permissions: t.permissions,
      is_platform_owner: false,
    }),
  );
  await page.route(new RegExp(`/api/v1/${ORG}/rbac/.*`), (r) => rbacRoute(r, s));
  await page.route(new RegExp(`/api/v1/${ORG}/users$`), (r) => {
    const b = r.request().postDataJSON() as { email: string; role_code?: string };
    s.invites.push(b);
    s.users.push({ user_id: CARA, email: b.email, name: '', status: 'active', roles: [b.role_code ?? 'member'], assignments: [] });
    return json(r, { user_id: CARA, email: b.email, tenant_id: user.tenant_id, created: true, role_code: b.role_code ?? 'member' }, 201);
  });
  await page.route(new RegExp(`/api/v1/${ORG}/people(\\?.*)?$`), (r) => {
    const q = (new URL(r.request().url()).searchParams.get('search') ?? '').toLowerCase();
    if (q) s.peopleSearches.push(q);
    const staff = s.users.filter((u) => u.user_id !== ME).map((u) => ({ user_id: u.user_id, name: u.name, email: u.email }));
    return json(r, page1(staff.filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.includes(q))));
  });
  return { s, user };
}
