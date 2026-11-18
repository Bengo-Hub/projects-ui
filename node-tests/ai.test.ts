import { test } from 'node:test';
import assert from 'node:assert/strict';

const ai = await import('../src/lib/ai/drafts.ts');
const perms = await import('../src/lib/auth/permissions.ts');

test('a credit refusal points at a top up, a provider failure says nothing was charged', () => {
  const out = ai.aiErrorInfo(402, { code: 'ai_credits_exhausted', reason: 'insufficient_credits' });
  assert.equal(out.topUp, true);
  assert.equal(out.retry, false);
  assert.match(out.message, /run out of AI credits/);
  assert.match(ai.aiErrorInfo(402, { code: 'ai_credits_exhausted', reason: 'service_not_activated' }).message, /first bundle/);
  assert.match(ai.aiErrorInfo(402, { code: 'ai_credits_exhausted', reason: 'no_subscription' }).message, /subscription/);
  const down = ai.aiErrorInfo(503, { code: 'ai_unavailable' });
  assert.equal(down.retry, true);
  assert.match(down.message, /Nothing was charged/);
  assert.equal(ai.aiErrorInfo(503, { code: 'ai_credits_unknown' }).retry, true);
  assert.equal(ai.aiErrorInfo(422, { code: 'validation_error', error: 'brief is required' }).message, 'brief is required');
  // No answer at all (a timeout): retry with the same key, never charged twice.
  assert.match(ai.aiErrorInfo(undefined, undefined).message, /not be charged twice/);
});

test('only ticked task drafts become create bodies, in order, under the parent', () => {
  const drafts = [
    { title: ' Survey ', description: 'Measure', priority: 'high', estimated_hours: 6 },
    { title: 'Plan', description: '', priority: 'medium', estimated_hours: null },
    { title: '   ', description: 'x', priority: 'low', estimated_hours: 2 },
  ];
  assert.deepEqual(ai.tasksToCreate(drafts, [2, 1, 0], 'p1'), [
    { title: 'Survey', description: 'Measure', priority: 'high', estimated_hours: 6, parent_id: 'p1' },
    { title: 'Plan', priority: 'medium', parent_id: 'p1' },
  ]);
  assert.deepEqual(ai.tasksToCreate(drafts, []), []);
});

test('risk drafts keep likelihood and impact on the 1 to 5 scale', () => {
  const drafts = [{ title: 'Late', description: '', category: 'schedule', likelihood: 9, impact: 0, mitigation: ' Order early ' }];
  assert.deepEqual(ai.risksToCreate(drafts, [0]), [{ title: 'Late', category: 'schedule', likelihood: 5, impact: 1, mitigation: 'Order early' }]);
});

test('selection, labels and summary text', () => {
  assert.deepEqual(ai.toggleIndex([0, 2], 1), [0, 1, 2]);
  assert.deepEqual(ai.toggleIndex([0, 1], 0), [1]);
  assert.deepEqual(ai.allIndexes(3), [0, 1, 2]);
  assert.equal(ai.hoursLabel(1.5), '1.5 h');
  assert.equal(ai.hoursLabel(null), '-');
  assert.equal(ai.creditsLine({ charged: 1, exempt: false, replayed: false }), '1 AI credit used.');
  assert.match(ai.creditsLine({ charged: 0, exempt: true, replayed: false }), /No AI credits used/);
  assert.match(ai.creditsLine({ charged: 0, exempt: false, replayed: true }), /no extra credits/);
  assert.equal(
    ai.summaryText({ summary: 'On course.', accomplishments: ['A'], next_steps: [], issues: ['B'] }),
    'On course.\n\nDone in the period\n- A\n\nIssues\n- B',
  );
  assert.deepEqual(
    ai.tasksNeedingEstimates([{ id: 'a' }, { id: 'b', estimated_hours: 3 }, { id: 'c', status: 'done' }, { id: 'd', estimated_hours: null }]),
    ['a', 'd'],
  );
  assert.match(ai.newRequestKey(), /^ai-[A-Za-z0-9._:-]{8,}$/);
  assert.notEqual(ai.newRequestKey(), ai.newRequestKey());
  assert.equal(ai.usageOutcome('failed'), 'No answer, not charged');
});

test('AI codes: managers and members ask, only administrators read usage', () => {
  const pm = perms.ROLE_PERMISSIONS.project_manager;
  const member = perms.ROLE_PERMISSIONS.member;
  const viewer = perms.ROLE_PERMISSIONS.viewer;
  assert.ok(pm.includes(perms.PERMS.aiAdd) && !pm.includes(perms.PERMS.aiView));
  assert.ok(member.includes(perms.PERMS.aiAdd));
  assert.ok(!viewer.includes(perms.PERMS.aiAdd));
  assert.ok(perms.ROLE_PERMISSIONS.projects_admin.includes(perms.PERMS.aiView));
  assert.equal(perms.permissionName('projects.ai.add'), 'Ask the AI assistant for drafts (spends AI credits)');
});
