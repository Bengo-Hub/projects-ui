import { test } from 'node:test';
import assert from 'node:assert/strict';

const rep = await import('../src/lib/reports/logic.ts');
const gov = await import('../src/lib/governance/logic.ts');
const perms = await import('../src/lib/auth/permissions.ts');

// Status reports (sprint 7).

test('the default period is the last full week, Monday to Sunday, as the API takes it', () => {
  // Tuesday 17 Nov 2026: the week of 9 to 15 Nov.
  assert.deepEqual(rep.lastFullWeek(new Date(2026, 10, 17, 9, 30)), { start: '2026-11-09', end: '2026-11-15' });
  // Monday 16 Nov: the week that just ended.
  assert.deepEqual(rep.lastFullWeek(new Date(2026, 10, 16)), { start: '2026-11-09', end: '2026-11-15' });
  // Sunday 22 Nov: this week is not over, so still the week before.
  assert.deepEqual(rep.lastFullWeek(new Date(2026, 10, 22, 23, 0)), { start: '2026-11-09', end: '2026-11-15' });
  // Across a year end.
  assert.deepEqual(rep.lastFullWeek(new Date(2027, 0, 6)), { start: '2026-12-28', end: '2027-01-03' });
});

test('a period needs both days, in order, and at most 100 days', () => {
  assert.equal(rep.periodError('2026-11-09', '2026-11-15'), null);
  assert.equal(rep.periodError('2026-11-09', '2026-11-09'), null);
  assert.match(rep.periodError('', '2026-11-15') ?? '', /first and last day/);
  assert.match(rep.periodError('2026-11-15', '2026-11-09') ?? '', /on or after/);
  assert.equal(rep.periodError('2026-01-01', '2026-04-11'), null);
  assert.match(rep.periodError('2026-01-01', '2026-04-12') ?? '', /at most 100 days/);
});

test('RAG helpers rank, pick the worst and name each rating', () => {
  assert.equal(rep.ragOf('amber'), 'amber');
  assert.equal(rep.ragOf('purple'), '');
  assert.equal(rep.ragOf(null), '');
  assert.ok(rep.ragRank('red') > rep.ragRank('amber'));
  assert.ok(rep.ragRank('green') > rep.ragRank(''));
  assert.equal(rep.worstRag('green', '', 'amber'), 'amber');
  assert.equal(rep.worstRag('green', 'red', 'amber'), 'red');
  assert.equal(rep.worstRag('', ''), '');
  assert.equal(rep.ragLabel('green'), 'Green');
  assert.equal(rep.ragLabel(''), 'Not rated');
  assert.match(rep.ragClass('red'), /bg-red/);
  assert.match(rep.ragClass(''), /border/);
});

test('highlights: trimmed, empty lines dropped, at most 20 of 300 characters', () => {
  assert.deepEqual(rep.cleanHighlights([' Slab poured ', '', '  ']), ['Slab poured']);
  assert.equal(rep.highlightsError(['a', 'b']), null);
  assert.match(rep.highlightsError(Array.from({ length: 21 }, (_, i) => `h${i}`)) ?? '', /at most 20/);
  assert.equal(rep.highlightsError([...Array.from({ length: 20 }, (_, i) => `h${i}`), '  ']), null);
  assert.match(rep.highlightsError(['x'.repeat(301)]) ?? '', /300 characters/);
});

test('publishing needs the overall rating', () => {
  assert.match(rep.publishProblem({ rag_overall: '' }) ?? '', /overall rating/);
  assert.equal(rep.publishProblem({ rag_overall: 'green' }), null);
});

const report = {
  id: 'r1',
  project_id: 'p1',
  title: 'Week 46',
  period_start: '2026-11-09T00:00:00Z',
  period_end: '2026-11-15T00:00:00Z',
  status: 'draft' as const,
  rag_overall: 'amber' as const,
  rag_schedule: 'amber' as const,
  rag_cost: '' as const,
  rag_scope: 'green' as const,
  narrative: '<p>On track.</p>',
  highlights: ['Slab poured'],
  risks: [{ risk_id: 'k1', title: 'Steel late', likelihood: 4, impact: 4, score: 16, status: 'open' }],
  milestones: [{ milestone_id: 'm1', name: 'Shell', status: 'pending', overdue: false }],
  client_visible: false,
  include_financials: false,
  created_at: '2026-11-17T08:00:00Z',
  updated_at: '2026-11-17T08:00:00Z',
};

test('a draft patch sends only what changed, lists whole', () => {
  const saved = rep.draftOf(report);
  assert.deepEqual(rep.draftPatch(saved, saved), {});
  const edited = { ...saved, rag_overall: 'red' as const, title: ' Week 46 ', highlights: [...saved.highlights, ' Roof ordered ', ''] };
  assert.deepEqual(rep.draftPatch(saved, edited), { rag_overall: 'red', highlights: ['Slab poured', 'Roof ordered'] });
  const trimmed = { ...saved, risks: [] };
  assert.deepEqual(rep.draftPatch(saved, trimmed), { risks: [] });
  assert.equal(rep.draftError({ ...saved, title: ' ' }), 'Give the report a title.');
  assert.equal(rep.draftError(saved), null);
  // The reading view's date part.
  assert.equal(rep.dayOnly(report.period_start), '2026-11-09');
  assert.equal(rep.dayOnly('2026-11-15'), '2026-11-15');
});

test('report actions follow the permissions, the plan and the status', () => {
  const pm = { canManage: true, canPortalManage: true, canFinancials: true, budgetTracking: true, clientPortal: true };
  const draft = rep.reportActions({ status: 'draft', client_visible: false }, pm);
  assert.deepEqual(draft, { edit: true, refresh: true, publish: true, delete: true, share: false, unshare: false, includeFinancials: false });
  const pub = rep.reportActions({ status: 'published', client_visible: true }, pm);
  assert.equal(pub.edit, false);
  assert.equal(pub.share, true);
  assert.equal(pub.unshare, true);
  assert.equal(pub.includeFinancials, true);
  // Without financials.view, or without budget_tracking, the share has no financials option.
  assert.equal(rep.reportActions({ status: 'published', client_visible: false }, { ...pm, canFinancials: false }).includeFinancials, false);
  assert.equal(rep.reportActions({ status: 'published', client_visible: false }, { ...pm, budgetTracking: false }).includeFinancials, false);
  // Sharing needs portal.manage too, and the client portal on the plan.
  assert.equal(rep.reportActions({ status: 'published', client_visible: false }, { ...pm, canPortalManage: false }).share, false);
  assert.equal(rep.reportActions({ status: 'published', client_visible: false }, { ...pm, clientPortal: false }).share, false);
  // A reader can do nothing.
  const viewer = { canManage: false, canPortalManage: false, canFinancials: false, budgetTracking: true, clientPortal: true };
  assert.deepEqual(Object.values(rep.reportActions({ status: 'draft', client_visible: false }, viewer)).filter(Boolean), []);
});

test('the financial section is shown, hidden for the role, or absent', () => {
  assert.equal(rep.financialState({ financials: { bac: 1 } }), 'shown');
  assert.equal(rep.financialState({ financials: null, financials_hidden: true }), 'hidden');
  assert.equal(rep.financialState({ financials: null, financials_hidden: false }), 'none');
});

test('refusals read as plain words, and the portal link matches the share notice', () => {
  assert.match(rep.reportErrorText('report_exists', 'a report exists', 'x'), /already a report for this period/);
  assert.match(rep.reportErrorText('admin_required', '', 'x'), /administrator/);
  assert.equal(rep.reportErrorText('validation_error', 'set the overall rating before publishing', 'x'), 'Set the overall rating before publishing.');
  assert.equal(rep.reportErrorText(undefined, undefined, 'Not saved'), 'Not saved');
  assert.equal(rep.portalReportPath('acme', 'p1', 'r1'), '/acme/portal/projects/p1?tab=reports&report=r1');
  assert.equal(rep.reportFileName({ title: 'Week 46: 9 to 15 Nov' }), 'week-46-9-to-15-nov.pdf');
  assert.equal(rep.indexText(0.9234), '0.92');
  assert.equal(rep.indexText(null), '-');
  assert.equal(rep.percentText(41.6), '42%');
});

// Governance (US-7.1).

test('a seat needs a role and a teammate or an outside name', () => {
  assert.equal(gov.seatError({ role: 'sponsor', user_id: 'u1', person_name: '' }), null);
  assert.equal(gov.seatError({ role: 'sponsor', user_id: '', person_name: 'Jane Board' }), null);
  assert.match(gov.seatError({ role: 'sponsor', user_id: '', person_name: '  ' }) ?? '', /teammate or type the name/);
  assert.match(gov.seatError({ role: 'chair', user_id: 'u1', person_name: '' }) ?? '', /governance role/);
  assert.equal(gov.seatHolder({ user_id: 'u1', user_name: 'Mary Member' }), 'Mary Member');
  assert.equal(gov.seatHolder({ person_name: 'Jane Board', organisation: 'Client plc' }), 'Jane Board, Client plc');
  assert.equal(gov.roleKindLabel('steering_committee'), 'Steering committee');
});

test('RACI rows: one accountable, at least one responsible, one letter a person', () => {
  const ok = { activity: 'Approve design', accountable_id: 'a', responsible_ids: ['b'], consulted_ids: ['c'], informed_ids: ['d'] };
  assert.equal(gov.raciError(ok), null);
  // The accountable may also be responsible.
  assert.equal(gov.raciError({ ...ok, responsible_ids: ['a'] }), null);
  assert.match(gov.raciError({ ...ok, activity: ' ' }) ?? '', /Name the activity/);
  assert.match(gov.raciError({ ...ok, accountable_id: '' }) ?? '', /accountable/);
  assert.match(gov.raciError({ ...ok, responsible_ids: [] }) ?? '', /at least one person responsible/);
  assert.match(gov.raciError({ ...ok, consulted_ids: ['a'] }) ?? '', /only also be responsible/);
  assert.match(gov.raciError({ ...ok, informed_ids: ['b'] }) ?? '', /one letter/);
  assert.match(gov.raciError({ ...ok, consulted_ids: ['c'], informed_ids: ['c'] }) ?? '', /one letter/);
  assert.match(gov.raciError({ ...ok, responsible_ids: Array.from({ length: 51 }, (_, i) => `r${i}`) }) ?? '', /at most 50/);
  const cols = gov.raciColumns({ id: 'e', activity: 'x', accountable_id: 'a', responsible_ids: ['b'], consulted_ids: null, informed_ids: [], position: 0 });
  assert.deepEqual(cols.map((c) => [c.letter, c.ids.length]), [['A', 1], ['R', 1], ['C', 0], ['I', 0]]);
  assert.deepEqual(gov.raciDraftOf(null), { activity: '', accountable_id: '', responsible_ids: [], consulted_ids: [], informed_ids: [] });
});

test('decisions: an approver answers once, a rejection needs a comment, managers edit proposed ones', () => {
  const d = { status: 'proposed' as const, approver_ids: ['me', 'other'], approvals: [{ user_id: 'other', decision: 'approve' as const, at: '2026-11-17T08:00:00Z' }] };
  assert.deepEqual(gov.decisionActions(d, 'me', false), { answer: true, edit: false, delete: false, supersede: false });
  assert.equal(gov.decisionActions(d, 'other', false).answer, false);
  assert.equal(gov.decisionActions(d, 'stranger', true).answer, false);
  assert.deepEqual(gov.decisionActions(d, 'stranger', true), { answer: false, edit: true, delete: true, supersede: false });
  assert.deepEqual(gov.decisionActions({ ...d, status: 'approved' }, 'me', true), { answer: false, edit: false, delete: false, supersede: true });
  assert.equal(gov.approverState(d, 'other'), 'approved');
  assert.equal(gov.approverState(d, 'me'), 'waiting');
  assert.equal(gov.approverState({ approvals: [{ user_id: 'me', decision: 'reject', at: '' }] }, 'me'), 'rejected');
  assert.match(gov.verdictError('reject', '  ') ?? '', /Say why/);
  assert.equal(gov.verdictError('approve', ''), null);
  assert.equal(gov.verdictError('reject', 'Too costly'), null);
  assert.match(gov.decisionFormError({ title: '', approver_ids: [] }) ?? '', /title/);
  assert.match(gov.decisionFormError({ title: 'x', approver_ids: Array.from({ length: 21 }, (_, i) => `a${i}`) }) ?? '', /at most 20 approvers/);
  assert.equal(gov.decisionRef(7), 'D-007');
  assert.match(gov.governanceErrorText('already_answered', '', 'x'), /already answered/);
  assert.equal(gov.governanceErrorText('validation_error', 'say why you reject it', 'x'), 'Say why you reject it.');
});

// Permissions mirror projects-api roles.go for sprint 7.

test('sprint 7 codes and role grants match projects-api', () => {
  const pm = perms.ROLE_PERMISSIONS.project_manager;
  assert.ok(pm.includes('projects.reports.manage'));
  assert.ok(pm.includes('projects.governance.manage'));
  // Manage implies view.
  assert.equal(perms.holds({ permissions: pm, bypass: false }, 'projects.reports.view'), true);
  assert.equal(perms.holds({ permissions: pm, bypass: false }, 'projects.governance.view'), true);
  for (const role of ['member', 'viewer']) {
    const codes = perms.ROLE_PERMISSIONS[role];
    assert.ok(codes.includes('projects.reports.view'), role);
    assert.ok(codes.includes('projects.governance.view'), role);
    assert.equal(perms.holds({ permissions: codes, bypass: false }, 'projects.reports.manage'), false, role);
  }
  assert.ok(perms.ROLE_PERMISSIONS.projects_admin.includes('projects.governance.manage'));
  assert.equal(perms.permissionName('projects.reports.manage'), 'Write, publish and share status reports');
  // The digest switch: only the admin tier changes it.
  assert.equal(perms.isAdminTier({ roles: ['project_manager'], global_roles: ['member'] }), false);
  assert.equal(perms.isAdminTier({ roles: ['projects_admin'] }), true);
});
