import { test } from 'node:test';
import assert from 'node:assert/strict';

const w = await import('../src/lib/planning/workload.ts');
const r = await import('../src/lib/planning/risks.ts');
const rep = await import('../src/lib/planning/repeat.ts');
const rules = await import('../src/lib/planning/rules.ts');
const ch = await import('../src/lib/planning/changes.ts');
const bl = await import('../src/lib/planning/baselines.ts');
const gantt = await import('../src/lib/work/gantt.ts');
const perms = await import('../src/lib/auth/permissions.ts');

// Workload.

test('heat bands follow the load, and the API overloaded flag wins', () => {
  assert.equal(w.heatBand(0, false, 0), 'none');
  assert.equal(w.heatBand(30, false), 'light');
  assert.equal(w.heatBand(50, false), 'medium');
  assert.equal(w.heatBand(85, false), 'high');
  assert.equal(w.heatBand(100, false), 'full');
  assert.equal(w.heatBand(101, true), 'over');
  // Zero capacity with demand: the API marks it overloaded even though the percent is 0.
  assert.equal(w.heatBand(0, true, 6), 'over');
});

test('week labels carry the ISO week and the Monday', () => {
  assert.equal(w.isoWeek('2026-11-16'), 47);
  assert.equal(w.weekLabel('2026-11-16'), 'W47, 16 Nov');
  // 29 Dec 2025 is in ISO week 1 of 2026.
  assert.equal(w.isoWeek('2025-12-29'), 1);
  assert.equal(w.mondayOf('2026-11-19'), '2026-11-16');
  assert.equal(w.mondayOf('2026-11-22'), '2026-11-16');
  assert.equal(w.addWeeks('2026-12-28', 1), '2027-01-04');
  assert.equal(w.thisMonday(new Date(2026, 10, 17)), '2026-11-16');
});

test('cells say the percent, or the hours without capacity', () => {
  assert.equal(w.cellText({ demand_hours: 0, capacity_hours: 40, load_pct: 0 }), '-');
  assert.equal(w.cellText({ demand_hours: 44, capacity_hours: 40, load_pct: 110 }), '110%');
  assert.equal(w.cellText({ demand_hours: 6.25, capacity_hours: 0, load_pct: 0 }), '6.3 h');
  assert.equal(w.hoursText(40), '40 h');
  assert.equal(w.validHours('37.5'), true);
  assert.equal(w.validHours('169'), false);
  assert.equal(w.validHours('-1'), false);
  assert.equal(w.clampWeeks(40), 26);
  assert.equal(w.clampWeeks(0), 1);
});

test('reassigning swaps the person and keeps the others in order', () => {
  assert.deepEqual(w.reassignedIds(['a', 'b'], 'a', 'c'), ['c', 'b']);
  assert.deepEqual(w.reassignedIds(['a', 'b'], 'b', 'a'), ['a']);
  assert.deepEqual(w.reassignedIds([], 'unassigned', 'c'), ['c']);
  assert.deepEqual(w.reassignedIds(['a'], 'unassigned', 'c'), ['a', 'c']);
});

// Risks.

test('the heat map puts likelihood 5 on top and impact 1 on the left', () => {
  const grid = [
    [1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 2, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 3],
  ];
  const rows = r.heatRows(grid);
  assert.equal(rows.length, 5);
  assert.equal(rows[0][0].likelihood, 5);
  assert.equal(rows[0][4].count, 3);
  assert.equal(rows[0][4].band, 'critical');
  assert.equal(rows[2][2].count, 2);
  assert.equal(rows[4][0].count, 1);
  assert.equal(rows[4][0].band, 'low');
  // A missing grid reads as zeros.
  assert.equal(r.heatRows(undefined)[0][0].count, 0);
});

test('a cell filter toggles and filters', () => {
  const c = { likelihood: 3, impact: 4 };
  assert.deepEqual(r.toggleCell(null, c), c);
  assert.equal(r.toggleCell(c, { likelihood: 3, impact: 4 }), null);
  assert.equal(r.inCell({ likelihood: 3, impact: 4 }, c), true);
  assert.equal(r.inCell({ likelihood: 4, impact: 3 }, c), false);
  assert.equal(r.inCell({ likelihood: 1, impact: 1 }, null), true);
});

test('scores band and the form follows the API rules', () => {
  assert.equal(r.riskScore(4, 5), 20);
  assert.equal(r.scoreBand(4), 'low');
  assert.equal(r.scoreBand(6), 'medium');
  assert.equal(r.scoreBand(12), 'high');
  assert.equal(r.scoreBand(15), 'critical');
  assert.equal(r.riskFormError({ title: ' ', likelihood: 3, impact: 3, due_date: '' }), 'Give the risk a title.');
  assert.match(r.riskFormError({ title: 'x', likelihood: 6, impact: 3, due_date: '' }) ?? '', /Likelihood/);
  assert.equal(r.riskFormError({ title: 'x', likelihood: 2, impact: 3, due_date: '2026-12-01' }), null);
  assert.deepEqual(r.riskPatch({ title: 'a', owner_id: 'u1', due_date: '2026-12-01' }, { title: 'a', owner_id: '', due_date: '2026-12-01' }), { owner_id: '' });
});

// Recurring tasks.

test('repeat rules read, describe and validate', () => {
  assert.equal(rep.readRepeat(undefined), null);
  assert.equal(rep.readRepeat({ repeat: { freq: 'yearly', interval: 1 } }), null);
  assert.deepEqual(rep.readRepeat({ repeat: { freq: 'weekly', interval: 2, until: '2026-12-31' } }), { freq: 'weekly', interval: 2, until: '2026-12-31' });
  assert.equal(rep.repeatText(null), 'Does not repeat');
  assert.equal(rep.repeatText({ freq: 'daily', interval: 1 }), 'Repeats every day');
  assert.equal(rep.repeatText({ freq: 'monthly', interval: 3, until: '2027-01-31' }), 'Repeats every 3 months until 31 Jan 2027');
  assert.equal(rep.modeOf({ freq: 'weekly', interval: 1 }), 'weekly');
  assert.equal(rep.modeOf({ freq: 'weekly', interval: 2 }), 'interval');
  assert.match(rep.repeatError({ freq: 'daily', interval: 0 }) ?? '', /1 to 365/);
  assert.match(rep.repeatError({ freq: 'daily', interval: 1, until: '2026-01-01' }, '2026-11-17') ?? '', /past/);
  assert.equal(rep.repeatError({ freq: 'daily', interval: 400 }) !== null, true);
  assert.deepEqual(rep.ruleFrom('interval', 'monthly', 2, ''), { freq: 'monthly', interval: 2 });
  assert.deepEqual(rep.ruleFrom('weekly', 'monthly', 9, '2027-01-01'), { freq: 'weekly', interval: 1, until: '2027-01-01' });
  assert.equal(rep.ruleFrom('none', 'daily', 1, ''), null);
});

test('the repeat rule is written into the rest of the metadata, and removed by leaving it out', () => {
  const meta = { stage: 'design', repeat: { freq: 'daily', interval: 1 }, recurrence: { series_id: 's' } };
  const next = rep.metadataWithRepeat(meta, { freq: 'weekly', interval: 2 });
  assert.deepEqual(next, { stage: 'design', repeat: { freq: 'weekly', interval: 2 } });
  assert.deepEqual(rep.metadataWithRepeat(meta, null), { stage: 'design' });
  assert.equal(rep.sameRule({ freq: 'daily', interval: 1 }, { freq: 'daily', interval: 1, until: '' }), true);
});

// Status rules and automations.

const KEYS = ['todo', 'in_progress', 'review', 'done'];

test('the moves matrix stays as short as it can be', () => {
  let s = rules.emptyRules();
  assert.equal(rules.moveAllowed(s, 'todo', 'done'), true);
  s = rules.toggleMove(s, KEYS, 'todo', 'done');
  assert.deepEqual(s.transitions, [{ from: 'todo', to: ['in_progress', 'review'] }]);
  assert.equal(rules.moveAllowed(s, 'todo', 'done'), false);
  assert.equal(rules.restricted(s, 'todo'), true);
  s = rules.toggleMove(s, KEYS, 'todo', 'done');
  assert.deepEqual(s.transitions, []);
  s = rules.toggleMove(s, KEYS, 'review', 'todo');
  assert.deepEqual(rules.clearMoves(s, 'review').transitions, []);
});

test('required fields are set per target status and checked', () => {
  let s = rules.setRequired(rules.emptyRules(), 'done', ['actual_hours', 'comment', 'actual_hours']);
  assert.deepEqual(rules.requiredFor(s, 'done'), ['actual_hours', 'comment']);
  assert.equal(rules.rulesError(s, KEYS), null);
  s = rules.setRequired(s, 'done', []);
  assert.deepEqual(s.requirements, []);
  assert.equal(rules.validFieldCode('metadata.signed_off'), true);
  assert.equal(rules.validFieldCode('metadata.Bad-Key'), false);
  assert.equal(rules.validFieldCode('colour'), false);
  assert.match(rules.rulesError({ transitions: [{ from: 'gone', to: ['done'] }], requirements: [] }, KEYS) ?? '', /no longer a column/);
  assert.match(rules.rulesError({ transitions: [], requirements: [{ to: 'done', fields: [] }] }, KEYS) ?? '', /no required fields/);
  assert.match(rules.rulesError({ transitions: [], requirements: [{ to: 'done', fields: ['colour'] }] }, KEYS) ?? '', /not a field/);
});

test('automations are checked against the API limits', () => {
  const ok = { name: 'QA hand-off', enabled: true, trigger: { to: 'review' }, actions: [{ type: 'assign' as const, user_ids: ['u1'], mode: 'add' as const }] };
  assert.equal(rules.automationsError([ok], KEYS), null);
  assert.match(rules.automationsError([{ ...ok, name: '' }], KEYS) ?? '', /needs a name/);
  assert.match(rules.automationsError([{ ...ok, trigger: { to: 'archived' } }], KEYS) ?? '', /status that starts it/);
  assert.match(rules.automationsError([{ ...ok, actions: [] }], KEYS) ?? '', /1 to 5 actions/);
  assert.match(rules.automationsError([{ ...ok, actions: Array(6).fill(ok.actions[0]) }], KEYS) ?? '', /1 to 5 actions/);
  assert.match(rules.automationsError(Array(26).fill(ok), KEYS) ?? '', /at most 25/);
  assert.match(rules.automationsError([{ ...ok, actions: [{ type: 'assign', user_ids: [] }] }], KEYS) ?? '', /at least one person/);
  assert.match(rules.automationsError([{ ...ok, actions: [{ type: 'notify', user_ids: [], recipients: [] }] }], KEYS) ?? '', /people or the assignees/);
  assert.match(rules.automationsError([{ ...ok, actions: [{ type: 'notify', user_ids: Array(21).fill('u') }] }], KEYS) ?? '', /at most 20/);
  assert.match(rules.automationsError([{ ...ok, actions: [{ type: 'set_field', field: 'priority', value: 'urgent' }] }], KEYS) ?? '', /critical/);
  assert.match(rules.automationsError([{ ...ok, actions: [{ type: 'set_field', field: 'metadata.repeat', value: 'x' }] }], KEYS) ?? '', /cannot be set/);
  assert.equal(rules.automationsError([{ ...ok, actions: [{ type: 'set_field', field: 'metadata.stage', value: 'qa' }] }], KEYS), null);
});

test('the save body drops empty parts and keeps ids', () => {
  const body = rules.automationsBody([
    { id: 'a1', name: ' Notify ', enabled: true, trigger: { to: 'done', from: '' }, actions: [{ type: 'notify', user_ids: [], recipients: ['assignees'], message: ' ' }] },
  ]);
  assert.deepEqual(body, [{ id: 'a1', name: 'Notify', enabled: true, trigger: { to: 'done' }, actions: [{ type: 'notify', recipients: ['assignees'] }] }]);
  const summary = rules.automationSummary(body[0], (k: string) => k.toUpperCase(), (id: string) => id);
  assert.equal(summary, 'When a task moves to DONE: notify the assignees.');
});

test('a blocked move says why', () => {
  const checks = [
    { status: 'done', allowed: false, reason: 'missing_fields', missing_fields: ['actual_hours'], message: 'Before moving to Done, this task needs actual hours.' },
    { status: 'review', allowed: false, reason: 'transition_not_allowed', missing_fields: [] },
    { status: 'todo', allowed: true, missing_fields: [] },
  ];
  assert.equal(rules.blockedReason(checks, 'done'), 'Before moving to Done, this task needs actual hours.');
  assert.equal(rules.blockedReason(checks, 'review'), 'The project rules do not allow this move.');
  assert.equal(rules.blockedReason(checks, 'todo'), null);
  assert.equal(rules.blockedReason(undefined, 'done'), null);
});

// Change requests.

const budget = { name: 'B', fiscal_year: '2027', period_type: 'monthly' as const, start_date: '2027-01-01', end_date: '2027-12-31', currency: 'KES', lines: [{ category: 'expense' as const, name: 'Steel', planned_amount: '1500.50' }] };

test('change request forms follow the API rules', () => {
  const base = { title: 'Second floor', kind: 'scope' as const, shifts: [], budgetMode: 'new' as const, budgetId: '', budget };
  assert.equal(ch.changeFormError(base), null);
  assert.equal(ch.changeFormError({ ...base, title: '' }), 'Give the change a title.');
  assert.match(ch.changeFormError({ ...base, kind: 'schedule' }) ?? '', /at least one task/);
  assert.match(ch.changeFormError({ ...base, kind: 'schedule', shifts: [{ task_id: 't', shift_days: 0 }] }) ?? '', /whole number/);
  assert.match(ch.changeFormError({ ...base, kind: 'schedule', shifts: [{ task_id: 't', shift_days: 2 }, { task_id: 't', shift_days: 3 }] }) ?? '', /twice/);
  assert.equal(ch.changeFormError({ ...base, kind: 'schedule', shifts: [{ task_id: 't', shift_days: -3 }] }), null);
  assert.equal(ch.changeFormError({ ...base, kind: 'cost' }), null);
  assert.match(ch.changeFormError({ ...base, kind: 'cost', budgetMode: 'existing' }) ?? '', /budget/);
  assert.match(ch.changeFormError({ ...base, kind: 'cost', budget: { ...budget, lines: [] } }) ?? '', /at least one budget line/);
  assert.match(ch.changeFormError({ ...base, kind: 'cost', budget: { ...budget, lines: [{ category: 'expense', name: 'x', planned_amount: '1.234' }] } }) ?? '', /two decimal/);
  assert.match(ch.changeFormError({ ...base, kind: 'cost', budget: { ...budget, end_date: '2026-01-01' } }) ?? '', /on or before/);
});

test('who may do what on a change request', () => {
  const cr = { status: 'pending', requested_by: 'me' };
  assert.deepEqual(ch.changeActions(cr, 'me', { canApprove: true, canManage: false, canAdd: true }), { decide: false, withdraw: true, ownRequest: true });
  assert.deepEqual(ch.changeActions(cr, 'other', { canApprove: true, canManage: false, canAdd: true }), { decide: true, withdraw: false, ownRequest: false });
  assert.deepEqual(ch.changeActions({ ...cr, status: 'approved' }, 'other', { canApprove: true, canManage: true, canAdd: true }), { decide: false, withdraw: false, ownRequest: false });
});

test('a failed or stuck treasury push may be retried', () => {
  const now = new Date('2026-11-17T10:00:00Z');
  assert.equal(ch.canRetryPush({ status: 'failed' }, now), true);
  assert.equal(ch.canRetryPush({ status: 'submitted' }, now), false);
  assert.equal(ch.canRetryPush({ status: 'pushing', attempted_at: '2026-11-17T09:59:00Z' }, now), false);
  assert.equal(ch.canRetryPush({ status: 'pushing', attempted_at: '2026-11-17T09:57:00Z' }, now), true);
  assert.equal(ch.pushStatus(undefined), 'not_needed');
});

test('refusals turn into plain words', () => {
  assert.match(ch.changeErrorText('own_change_request', 'x', 'f'), /someone else/);
  assert.match(ch.changeErrorText('change_request_not_pending', '', 'f'), /already decided/);
  assert.match(ch.changeErrorText('budget_push_done', '', 'f'), /already in treasury/);
  assert.equal(ch.changeErrorText('validation_error', 'title is required', 'f'), 'Title is required');
  assert.equal(ch.changeErrorText(undefined, '', 'Fallback'), 'Fallback');
  assert.equal(ch.shiftText(3), '3 days later');
  assert.equal(ch.shiftText(-1), '1 day earlier');
  assert.equal(ch.shiftedDate('2026-12-30T00:00:00Z', 3), '2027-01-02');
});

// Baselines and slips.

test('slips read as late or early, biggest first', () => {
  assert.equal(bl.slipText(0), 'On time');
  assert.equal(bl.slipText(1), '1 day late');
  assert.equal(bl.slipText(-4), '4 days early');
  assert.equal(bl.finishChange({ finish_slip_days: 0, baseline_finish: null, current_finish: '2026-12-01' }), 'Gained a due date');
  assert.equal(bl.finishChange({ finish_slip_days: 0, baseline_finish: '2026-12-01', current_finish: null }), 'Lost its due date');
  const sorted = bl.sortSlips([
    { id: 'a', finish_slip_days: 2, baseline_finish: 'x', current_finish: 'y' },
    { id: 'b', finish_slip_days: 9, baseline_finish: 'x', current_finish: 'y' },
    { id: 'c', finish_slip_days: -3, baseline_finish: 'x', current_finish: 'y' },
  ]);
  assert.deepEqual(sorted.map((s: { id: string }) => s.id), ['b', 'a', 'c']);
  const counts = { tasks_compared: 12, slipped: 3, pulled_in: 1, max_slip_days: 9, removed_since: 0, added_since: 2, milestones_slipped: 1 };
  assert.equal(bl.slipSummary(counts), '3 of 12 tasks slipped, the worst by 9 days, 1 pulled in.');
  assert.equal(bl.slipSummary({ ...counts, slipped: 0, pulled_in: 0 }), 'All 12 tasks are on their baseline dates.');
});

test('baseline bars sit on their live task rows', () => {
  const rows = [
    { id: 't1', title: 'A', status: 'todo', start_date: '2026-11-02', due_date: '2026-11-06' },
    { id: 't2', title: 'B', status: 'todo', start_date: '2026-11-09', due_date: '2026-11-12' },
  ];
  const bars = gantt.baselineBars(rows, { t2: { id: 't2', title: 'B', status: 'todo', start_date: '2026-11-05', due_date: '2026-11-08' } });
  assert.equal(bars.length, 1);
  assert.equal(bars[0].row, 1);
  assert.equal(bars[0].end - bars[0].start, 3);
  assert.deepEqual(gantt.baselineBars(rows, null), []);
});

// Permissions mirror projects-api roles.go for sprint 16.

test('sprint 16 codes and role grants match projects-api', () => {
  const pm = perms.ROLE_PERMISSIONS.project_manager;
  for (const c of ['projects.workload.view', 'projects.baselines.add', 'projects.risks.delete', 'projects.change_requests.manage', 'projects.change_approvals.manage', 'projects.templates.add', 'projects.automation.manage']) {
    assert.ok(pm.includes(c), c);
  }
  assert.equal(pm.includes('projects.workload.manage'), false);
  assert.equal(pm.includes('projects.templates.delete'), false);
  const member = perms.ROLE_PERMISSIONS.member;
  assert.ok(member.includes('projects.automation.view'));
  assert.equal(perms.holds({ permissions: member, bypass: false }, 'projects.change_approvals.manage'), false);
  const viewer = perms.ROLE_PERMISSIONS.viewer;
  assert.deepEqual(
    viewer.filter((c: string) => /baselines|risks|change_requests/.test(c)),
    ['projects.baselines.view', 'projects.risks.view', 'projects.change_requests.view'],
  );
  assert.equal(perms.holds({ permissions: ['projects.change_requests.manage'], bypass: false }, 'projects.change_requests.add'), true);
  assert.equal(perms.permissionName('projects.change_approvals.manage'), 'Approve and reject change requests');
});
