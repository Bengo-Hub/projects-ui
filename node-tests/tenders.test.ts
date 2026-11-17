import { test } from 'node:test';
import assert from 'node:assert/strict';

const t = await import('../src/lib/tenders/logic.ts');

const crit = (score: number, weight = 10, key = `k${score}${weight}`) => ({ key, label: key, weight, score });

test('the weighted score and recommendation follow projects-api (go at the threshold, review 15 below)', () => {
  // All fives is 100, all zeros is 0.
  assert.deepEqual(t.scoreCriteria([crit(5, 20, 'a'), crit(5, 10, 'b')]), { weighted_score: 100, recommendation: 'go', threshold: 65 });
  assert.equal(t.scoreCriteria([crit(0, 10, 'a')])?.recommendation, 'no_go');
  // 3.25 of 5 is 65.0: exactly the threshold is go.
  const at = t.scoreCriteria([crit(3, 30, 'a'), crit(4, 10, 'b')]);
  assert.equal(at?.weighted_score, 65);
  assert.equal(at?.recommendation, 'go');
  // 2.5 of 5 is 50: the review band starts 15 below the threshold.
  assert.equal(t.scoreCriteria([crit(2, 10, 'a'), crit(3, 10, 'b')])?.recommendation, 'review');
  assert.equal(t.scoreCriteria([crit(2, 10, 'a'), crit(3, 10, 'b')], 80)?.recommendation, 'no_go');
  // One decimal, rounded.
  assert.equal(t.scoreCriteria([crit(1, 3, 'a'), crit(2, 3, 'b'), crit(2, 3, 'c')])?.weighted_score, 33.3);
  assert.equal(t.scoreCriteria([]), null);
});

test('a decision against the recommendation needs a comment; review always does', () => {
  const go = [crit(5, 10, 'a')];
  assert.equal(t.decisionError(go, 'go', ''), null);
  assert.match(t.decisionError(go, 'no_go', '') ?? '', /differs/);
  assert.equal(t.decisionError(go, 'no_go', 'client is in arrears'), null);
  const review = [crit(2, 10, 'a'), crit(3, 10, 'b')];
  assert.match(t.decisionError(review, 'go', '') ?? '', /differs/);
  assert.match(t.decisionError(go, '', '') ?? '', /go or no go/);
  assert.match(t.decisionError([], 'go', '') ?? '', /at least one/);
  assert.match(t.decisionError([crit(6, 10, 'a')], 'go', '') ?? '', /score from 0 to 5/);
  assert.match(t.decisionError([crit(3, 0, 'a')], 'go', 'x') ?? '', /weight/);
  assert.match(t.decisionError([crit(3, 10, 'a'), crit(4, 10, 'a')], 'go', 'x') ?? '', /twice/);
});

test('criterion keys come from the label and never repeat', () => {
  assert.equal(t.criterionKey('Local content %', []), 'local_content');
  assert.equal(t.criterionKey('Local content', ['local_content']), 'local_content_2');
  assert.equal(t.criterionKey('!!!', []), 'criterion');
});

test('the lifecycle gates match the API status machine', () => {
  for (const s of ['draft', 'evaluating', 'preparing', 'no_go']) assert.equal(t.canDecide(s), true, s);
  for (const s of ['submitted', 'awarded', 'lost', 'cancelled']) assert.equal(t.canDecide(s), false, s);
  assert.equal(t.canSubmit('preparing'), true);
  assert.equal(t.canSubmit('shortlisted'), true);
  assert.equal(t.canSubmit('evaluating'), false);
  assert.equal(t.canRecordOutcome('under_review'), true);
  assert.equal(t.canRecordOutcome('preparing'), false);
  assert.equal(t.sectionsOpen('preparing'), true);
  assert.equal(t.sectionsOpen('awarded'), false);
  assert.equal(t.tenderStatusLabel('awarded'), 'Won');
  // A status from before the current vocabulary, or none, shows as draft and never throws.
  assert.equal(t.tenderStatusLabel('something_new'), 'Draft');
  assert.equal(t.tenderStatusLabel(undefined), 'Draft');
  assert.equal(t.displayStatus('bidding'), 'draft');
  assert.equal(t.displayStatus('shortlisted'), 'shortlisted');
  assert.equal(t.moveLabel('cancelled'), 'Cancel tender');
  assert.equal(t.TENDER_STATUSES.length, 10);
});

test('sections are ready only when every one is approved', () => {
  assert.equal(t.summarizeSections([]).ready, false);
  const s = t.summarizeSections(['approved', 'in_review', 'approved']);
  assert.equal(s.total, 3);
  assert.equal(s.by_status.approved, 2);
  assert.equal(s.by_status.not_started, 0);
  assert.equal(s.ready, false);
  assert.equal(t.summarizeSections(['approved', 'approved']).ready, true);
});

test('section actions: the assignee works and submits, the reviewer reviews, never their own', () => {
  const me = 'me';
  const mine = t.sectionActions({ status: 'in_progress', assignee_id: me, reviewer_id: 'rv' }, me, false);
  assert.equal(mine.canSubmit, true);
  assert.equal(mine.canReview, false);
  const inReview = { status: 'in_review', assignee_id: me, reviewer_id: 'rv' };
  // A manager who is also the assignee still cannot review it.
  assert.equal(t.sectionActions(inReview, me, true).canReview, false);
  assert.equal(t.sectionActions(inReview, 'rv', false).canReview, true);
  assert.equal(t.sectionActions(inReview, 'someone', false).canReview, false);
  assert.equal(t.sectionActions(inReview, 'manager', true).canReview, true);
  assert.equal(t.sectionActions({ status: 'approved', assignee_id: me }, me, true).canSubmit, false);
  assert.equal(t.sectionActions({ status: 'changes_requested', assignee_id: 'x' }, me, false).canSubmit, false);
});

test('submissions need the right recipient for the method', () => {
  assert.equal(t.submissionError('online', ''), null);
  assert.match(t.submissionError('email', 'not an address') ?? '', /email address/);
  assert.equal(t.submissionError('email', 'tenders@county.go.ke'), null);
  assert.match(t.submissionError('physical', '  ') ?? '', /address/);
  assert.match(t.submissionError('fax', 'x') ?? '', /Choose/);
});

test('bid budget lines and their total', () => {
  assert.equal(t.bidLineError({ name: 'Labour', category: 'expense', planned_amount: '1200.50' }), null);
  assert.match(t.bidLineError({ name: ' ', planned_amount: '1' }) ?? '', /name/);
  assert.match(t.bidLineError({ name: 'x', planned_amount: '1.234' }) ?? '', /two decimal/);
  assert.match(t.bidLineError({ name: 'x', category: 'other', planned_amount: '1' }) ?? '', /category/);
  assert.equal(t.bidTotal([{ planned_amount: '0.1' }, { planned_amount: '0.2' }]), 0.3);
});

test('the conversion budget retry is offered only for pending or failed pushes', () => {
  assert.equal(t.canRetryBudget('failed'), true);
  assert.equal(t.canRetryBudget('pending'), true);
  assert.equal(t.canRetryBudget('created'), false);
  assert.equal(t.canRetryBudget(undefined), false);
  assert.ok(t.BUDGET_STATE_LABEL.not_allowed.includes('permission'));
});

test('a bid budget names its first bad line', () => {
  assert.equal(t.bidBudgetError([]), null);
  assert.equal(t.bidBudgetError([{ name: 'a', planned_amount: '1' }]), null);
  assert.match(t.bidBudgetError([{ name: 'a', planned_amount: '1' }, { name: '', planned_amount: '1' }]) ?? '', /^Line 2:/);
});

test('tags are trimmed, kept once whatever the case, 50 characters and 20 at most', () => {
  assert.deepEqual(t.addTag(['ICT'], ' roads ').tags, ['ICT', 'roads']);
  assert.deepEqual(t.addTag(['ICT'], 'ict'), { tags: ['ICT'], error: null });
  assert.deepEqual(t.addTag(['ICT'], '   '), { tags: ['ICT'], error: null });
  assert.match(t.addTag([], 'x'.repeat(51)).error ?? '', /50/);
  const full = Array.from({ length: 20 }, (_, i) => `t${i}`);
  assert.match(t.addTag(full, 'one more').error ?? '', /20/);
});

test('a tender edit sends only what changed, with null to remove a metadata key', () => {
  const before = { title: 'A', source: '', deadline: '2026-12-15' };
  assert.deepEqual(t.tenderPatch(before, { ...before }, { tags: ['x'] }, { tags: ['x'] }), {});
  assert.deepEqual(t.tenderPatch(before, { ...before, source: 'Portal', deadline: '' }, {}, {}), { source: 'Portal', deadline: '' });
  assert.deepEqual(t.tenderPatch(before, before, { tags: ['x'], crm_contact_id: 'c1' }, { tags: [], crm_contact_id: '' }), { metadata: { tags: null, crm_contact_id: null } });
  // An empty list where there was none is no change.
  assert.deepEqual(t.tenderPatch(before, before, {}, { tags: [] }), {});
});
