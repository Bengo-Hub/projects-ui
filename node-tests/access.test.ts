import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  lockedBy,
  permissionSetProblem,
  roleKind,
  roleDeletable,
  isReservedRole,
  groupByModule,
  moduleTitle,
  effectivePermissionGroups,
  endOfDayISO,
  assignmentState,
  assignableRoles,
  isAdminTier,
  auditLabel,
  auditSubject,
  PROJECT_MEMBER_ROLES,
} = await import('../src/lib/auth/permissions.ts');

test('a code granted by a selected manage (or full form) is locked, with what grants it', () => {
  assert.equal(lockedBy('projects.tasks.view', ['projects.tasks.manage']), 'projects.tasks.manage');
  assert.equal(lockedBy('projects.tasks.view_own', ['projects.tasks.view']), 'projects.tasks.view');
  assert.equal(lockedBy('projects.qa.view', ['projects.qa.run']), 'projects.qa.run');
  assert.equal(lockedBy('projects.tasks.manage', ['projects.tasks.manage']), null);
  assert.equal(lockedBy('projects.tasks.view', ['projects.projects.manage']), null);
});

test('client portal access never sits beside staff codes', () => {
  assert.equal(permissionSetProblem(['projects.portal.view']), null);
  assert.equal(permissionSetProblem(['projects.tasks.view', 'projects.projects.view']), null);
  assert.ok(permissionSetProblem(['projects.portal.view', 'projects.portal.manage']));
});

test('role badges and delete rules follow scope', () => {
  assert.equal(roleKind({ scope: 'global', is_customized: false }), 'Default');
  assert.equal(roleKind({ scope: 'tenant', is_customized: true }), 'Customised');
  assert.equal(roleKind({ scope: 'tenant', is_customized: false }), 'Your role');
  assert.equal(roleDeletable({ scope: 'tenant', is_system_role: false, code: 'site_lead' }), true);
  assert.equal(roleDeletable({ scope: 'global', is_system_role: true, code: 'member' }), false);
  assert.equal(isReservedRole('projects_admin'), true);
  assert.equal(isReservedRole('client'), true);
  assert.equal(isReservedRole('member'), false);
});

test('the editor groups by module in registry order', () => {
  const groups = groupByModule([
    { code: 'projects.projects.view', module: 'projects' },
    { code: 'projects.tasks.view', module: 'tasks' },
    { code: 'projects.projects.add', module: 'projects' },
  ]);
  assert.deepEqual(groups.map((g) => g.module), ['projects', 'tasks']);
  assert.equal(groups[0].perms.length, 2);
  assert.equal(moduleTitle('rbac'), 'Team and roles');
  assert.equal(moduleTitle('change_requests'), 'Change requests');
  assert.equal(moduleTitle('tenders'), 'Tenders');
});

test('a person\'s effective permissions group by module in registry order, unknown codes last', () => {
  const registry = [
    { code: 'projects.projects.view', name: 'View projects', module: 'projects' },
    { code: 'projects.tasks.view', name: 'View tasks', module: 'tasks' },
    { code: 'projects.tasks.add', name: 'Create tasks', module: 'tasks' },
    { code: 'projects.rbac.manage', name: 'Manage roles', module: 'rbac' },
  ];
  const groups = effectivePermissionGroups(
    ['projects.tasks.add', 'projects.projects.view', 'projects.tasks.add', 'projects.tasks.view', 'projects.ledger.view'],
    registry,
  );
  assert.deepEqual(groups.map((g) => g.module), ['projects', 'tasks', 'ledger']);
  assert.deepEqual(groups[1].perms.map((p) => p.name), ['View tasks', 'Create tasks']);
  assert.equal(groups[1].title, 'Tasks');
  // A code the registry does not know keeps its code as its name.
  assert.deepEqual(groups[2], { module: 'ledger', title: 'Ledger', perms: [{ code: 'projects.ledger.view', name: 'projects.ledger.view' }] });
  // Nothing held, nothing shown; codes not held never show.
  assert.deepEqual(effectivePermissionGroups([], registry), []);
  assert.equal(effectivePermissionGroups(['projects.rbac.manage'], registry)[0].title, 'Team and roles');
});

test('end dates: end of the chosen day, none when empty; state of a held role', () => {
  assert.equal(endOfDayISO(''), null);
  const iso = endOfDayISO('2099-03-04')!;
  const d = new Date(iso);
  assert.equal(d.getFullYear(), 2099);
  assert.equal(d.getHours(), 23);
  const now = Date.parse('2026-11-17T10:00:00Z');
  assert.equal(assignmentState({ expires_at: null, expired: false }, now), 'running');
  assert.equal(assignmentState({ expires_at: '2026-12-01T00:00:00Z', expired: false }, now), 'ending');
  assert.equal(assignmentState({ expires_at: '2026-11-01T00:00:00Z', expired: false }, now), 'ended');
  assert.equal(assignmentState({ expires_at: '2026-12-01T00:00:00Z', expired: true }, now), 'ended');
});

test('assignable roles: never client, never one still running, projects_admin for admins only', () => {
  const roles = ['projects_admin', 'project_manager', 'member', 'viewer', 'client'].map((code) => ({ code }));
  const held = [
    { role_code: 'member', expired: false },
    { role_code: 'viewer', expired: true },
  ];
  assert.deepEqual(assignableRoles(roles, held, false).map((r) => r.code), ['project_manager', 'viewer']);
  assert.deepEqual(assignableRoles(roles, held, true).map((r) => r.code), ['projects_admin', 'project_manager', 'viewer']);
});

test('admin tier: platform owner, admin or superuser global role, or projects_admin', () => {
  assert.equal(isAdminTier({ roles: ['projects_admin'] }), true);
  assert.equal(isAdminTier({ global_roles: ['Admin'], roles: [] }), true);
  assert.equal(isAdminTier({ is_platform_owner: true }), true);
  assert.equal(isAdminTier({ global_roles: ['staff'], roles: ['team_lead'] }), false);
  assert.equal(isAdminTier(null), false);
  assert.equal(isAdminTier(null, true), true);
});

test('role changes read as plain words', () => {
  assert.equal(auditLabel('role.permissions_updated'), 'Changed permissions');
  assert.equal(auditLabel('something.else'), 'something.else');
  assert.equal(auditSubject({ name: 'Site lead' }), 'Site lead');
  assert.equal(auditSubject({ email: 'a@b.c', role_code: 'viewer' }), 'a@b.c');
  assert.equal(auditSubject({ role_code: 'project_manager' }), 'Project manager');
  assert.equal(auditSubject(null), '');
});

test('project member roles match projects-api members.Roles', () => {
  assert.deepEqual(PROJECT_MEMBER_ROLES.map((r) => r.value), ['owner', 'manager', 'member', 'viewer']);
});
