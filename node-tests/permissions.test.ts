import { test } from 'node:test';
import assert from 'node:assert/strict';

const { holds, holdsAny, impliers, inferProfile, roleFromGlobalRoles, ROLE_PERMISSIONS, ALL_PERMISSIONS, permissionName } = await import(
  '../src/lib/auth/permissions.ts'
);

const p = (permissions: string[], bypass = false) => ({ permissions, bypass });

test('implication follows projects-api: manage grants the module, full forms grant _own, run grants QA view', () => {
  assert.deepEqual(impliers('projects.tasks.view_own'), ['projects.tasks.manage', 'projects.tasks.view']);
  assert.deepEqual(impliers('projects.tasks.manage'), []);
  assert.ok(impliers('projects.qa.view').includes('projects.qa.run'));
  assert.equal(holds(p(['projects.tasks.manage']), 'projects.tasks.delete'), true);
  assert.equal(holds(p(['projects.tasks.change']), 'projects.tasks.change_own'), true);
  assert.equal(holds(p(['projects.tasks.change_own']), 'projects.tasks.change'), false);
  assert.equal(holds(p(['projects.qa.run']), 'projects.qa.view'), true);
  assert.equal(holds(p(['projects.projects.manage']), 'projects.tasks.view'), false);
});

test('bypass passes every check; nothing passes without a profile', () => {
  assert.equal(holds(p([], true), 'projects.rbac.manage'), true);
  assert.equal(holds(null, 'projects.projects.view'), false);
  assert.equal(holdsAny(p(['projects.tasks.view_own']), ['projects.tasks.view', 'projects.tasks.view_own']), true);
});

test('global roles map to the default projects role, as MapGlobalRoles', () => {
  assert.equal(roleFromGlobalRoles(['Admin']), 'projects_admin');
  assert.equal(roleFromGlobalRoles(['staff', 'customer']), 'member');
  assert.equal(roleFromGlobalRoles([]), 'viewer');
  const inferred = inferProfile({ id: 'u', email: 'a@b.c', fullName: 'A', tenant_id: 't', roles: ['manager'], isPlatformOwner: false });
  assert.equal(inferred.service_role, 'member');
  assert.deepEqual(inferred.permissions, ROLE_PERMISSIONS.member);
  assert.equal(ROLE_PERMISSIONS.projects_admin.length, ALL_PERMISSIONS.length);
  assert.equal(ROLE_PERMISSIONS.viewer.includes('projects.projects.add'), false);
});

test('permission names come from the registry', () => {
  assert.equal(permissionName('projects.projects.add'), 'Create projects');
  assert.equal(permissionName('projects.unknown.x'), 'projects.unknown.x');
});
