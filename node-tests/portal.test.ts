import { test } from 'node:test';
import assert from 'node:assert/strict';

const portal = await import('../src/lib/portal/logic.ts');
const perms = await import('../src/lib/auth/permissions.ts');

test('portal paths: only /{org}/portal and below, never a look-alike', () => {
  assert.equal(portal.isPortalPath('/acme/portal', 'acme'), true);
  assert.equal(portal.isPortalPath('/acme/portal/projects/p1', 'acme'), true);
  assert.equal(portal.isPortalPath('/acme/portalx', 'acme'), false);
  assert.equal(portal.isPortalPath('/acme/projects', 'acme'), false);
  assert.equal(portal.isPortalPath('/other/portal', 'acme'), false);
  assert.equal(portal.isPortalPath(null, 'acme'), false);
  assert.equal(portal.portalCallbackUrl('https://projects.codevertexafrica.com', 'acme'), 'https://projects.codevertexafrica.com/acme/portal/auth/callback');
});

test('return after sign-in: a portal page of this firm, else the portal home', () => {
  const o = 'https://projects.example.test';
  assert.equal(portal.safePortalReturn(`${o}/acme/portal/projects/p1?milestone=m1`, 'acme', o), '/acme/portal/projects/p1?milestone=m1');
  assert.equal(portal.safePortalReturn(`${o}/acme/dashboard`, 'acme', o), '/acme/portal');
  assert.equal(portal.safePortalReturn('https://evil.test/acme/portal', 'acme', o), '/acme/portal');
  assert.equal(portal.safePortalReturn(`${o}/acme/portal/auth/callback?code=x`, 'acme', o), '/acme/portal');
  assert.equal(portal.safePortalReturn(null, 'acme', o), '/acme/portal');
});

test('X-Client-Invites: email_not_verified in any header case asks for verification', () => {
  assert.equal(portal.invitesNeedVerification({ 'x-client-invites': 'email_not_verified' }), true);
  assert.equal(portal.invitesNeedVerification({ 'X-Client-Invites': ' EMAIL_NOT_VERIFIED ' }), true);
  assert.equal(portal.invitesNeedVerification({ 'x-client-invites': 'attached' }), false);
  assert.equal(portal.invitesNeedVerification({}), false);
  assert.equal(portal.invitesNeedVerification(undefined), false);
  assert.equal(portal.verifyEmailUrl('https://accounts.example.test/'), 'https://accounts.example.test/dashboard/profile?tab=email');
});

test('milestone review: who may send it up and what a decision needs', () => {
  for (const s of ['pending', 'in_progress', 'missed', 'changes_requested']) assert.equal(portal.canMarkReady(s), true, s);
  for (const s of ['ready_for_review', 'approved', 'completed']) assert.equal(portal.canMarkReady(s), false, s);
  assert.equal(portal.decisionProblem('approve', ''), null);
  assert.match(portal.decisionProblem('request_changes', '   ') ?? '', /what needs to change/);
  assert.equal(portal.decisionProblem('request_changes', 'Move the door'), null);
  assert.match(portal.decisionProblem('approve', 'x'.repeat(2001)) ?? '', /2000/);
  assert.equal(portal.decisionProblem('approve', 'x'.repeat(2000)), null);
  assert.equal(portal.milestoneLabel('ready_for_review'), 'Ready for your review');
  assert.equal(portal.teamMilestoneLabel('ready_for_review'), 'Waiting for client review');
  assert.equal(portal.milestoneLabel('something_new'), 'something new');
});

test('refusals: 409 not ready, plan, not a client, not found', () => {
  assert.equal(portal.portalRefusal(409, 'milestone_not_ready'), 'not_ready');
  assert.equal(portal.portalRefusal(403, 'feature_not_available'), 'no_feature');
  assert.equal(portal.portalRefusal(403, 'permission_denied'), 'not_client');
  assert.equal(portal.portalRefusal(404, undefined), 'not_found');
  assert.equal(portal.portalRefusal(500, undefined), null);
  assert.equal(portal.portalRefusal(409, 'idempotency_key_reused'), null);
});

test('invites, client rows, progress and sharing flags', () => {
  assert.match(portal.inviteOutcome('Jane Client', false), /^Jane Client is invited/);
  assert.match(portal.inviteOutcome('Jane Client', true), /went out again/);
  assert.match(portal.inviteOutcome('  ', false), /^The client/);
  assert.equal(portal.clientStatusLabel('active'), 'Signed in');
  assert.equal(portal.clientStatusLabel('invited'), 'Invited');
  assert.equal(portal.clampPercent(140), 100);
  assert.equal(portal.clampPercent(-3), 0);
  assert.equal(portal.clampPercent(undefined), 0);
  assert.equal(portal.clampPercent(33.4), 33);
  assert.equal(portal.isClientVisible({ client_visible: true }), true);
  assert.equal(portal.isClientVisible({ client_visible: 'true' }), false);
  assert.equal(portal.isClientVisible(undefined), false);
});

test('last decision: the outcome with who decided, the same line on both sides', () => {
  assert.equal(portal.decisionSummary({ decision: 'approved', decided_by_name: 'Jane Client' }), 'Approved by Jane Client');
  assert.equal(portal.decisionSummary({ decision: 'changes_requested', decided_by_name: ' ' }), 'Changes requested');
  assert.equal(portal.decisionSummary({ decision: 'changes_requested', decided_by_name: null }), 'Changes requested');
});

test('landing note: milestones waiting first, then milestones done, then tasks done', () => {
  const p = { awaiting_review: 0, milestones_total: 0, milestones_done: 0, tasks_total: 0, tasks_done: 0 };
  assert.equal(portal.landingNote({ ...p, awaiting_review: 1, milestones_total: 3 }), '1 milestone waiting for you');
  assert.equal(portal.landingNote({ ...p, awaiting_review: 2 }), '2 milestones waiting for you');
  assert.equal(portal.landingNote({ ...p, milestones_total: 4, milestones_done: 1, tasks_total: 9 }), '1 of 4 milestones done');
  assert.equal(portal.landingNote({ ...p, milestones_total: 1, milestones_done: 1 }), '1 of 1 milestone done');
  assert.equal(portal.landingNote({ ...p, tasks_total: 10, tasks_done: 4 }), '4 of 10 tasks done');
  assert.equal(portal.landingNote(p), '');
  assert.equal(portal.landingNote(undefined), '');
});

test('thread author: You for the reader, else the name, tagged Client or Team', () => {
  const jane = { author_id: 'u1', author_name: 'Jane Client', author_kind: 'client' };
  assert.deepEqual(portal.threadAuthor(jane, 'u1'), { name: 'You', tag: 'Client', mine: true });
  assert.deepEqual(portal.threadAuthor(jane, 'u2'), { name: 'Jane Client', tag: 'Client', mine: false });
  assert.deepEqual(portal.threadAuthor({ author_id: 'u3', author_name: '', author_kind: 'team' }, 'u1'), { name: 'Someone from the team', tag: 'Team', mine: false });
  assert.deepEqual(portal.threadAuthor({ author_id: 'u4', author_name: '', author_kind: 'client' }), { name: 'A client', tag: 'Client', mine: false });
  // An entry without author_kind reads as the team, never as a client.
  assert.equal(portal.threadAuthor({ author_id: 'u5', author_name: 'Ted' }, 'u1').tag, 'Team');
});

test('roles: a project manager manages the portal; the global client role maps to client', () => {
  assert.ok(perms.ROLE_PERMISSIONS.project_manager.includes(perms.PERMS.portalManage));
  assert.deepEqual(perms.ROLE_PERMISSIONS.client, [perms.PERMS.portalView]);
  assert.equal(perms.roleFromGlobalRoles(['client']), 'client');
  assert.equal(perms.roleFromGlobalRoles(['client', 'staff']), 'member');
  assert.equal(perms.roleFromGlobalRoles(['staff', 'client']), 'member');
  assert.equal(perms.roleFromGlobalRoles(['client', 'admin']), 'projects_admin');
  // manage implies view, as in projects-api; the client routes still answer 404 to anyone who is
  // not an active client of the project.
  assert.equal(perms.holds({ permissions: [perms.PERMS.portalManage], bypass: false }, perms.PERMS.portalView), true);
});
