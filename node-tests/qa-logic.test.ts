import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  acceptBlockedReason,
  canRaiseTicket,
  chunk,
  describeDevice,
  mergeVerdicts,
  normalizeVerdict,
  parseCriteriaImport,
  parseCsv,
  parseDrafts,
  pruneDrafts,
  qaAllowed,
  shareLink,
  verdictProblem,
} = await import('../src/lib/qa/logic.ts');

test('qaAllowed follows projects-api: manage covers all, run covers view, admins and the owner pass', () => {
  assert.equal(qaAllowed(null, 'view'), false);
  assert.equal(qaAllowed({ permissions: [] }, 'view'), false);
  assert.equal(qaAllowed({ permissions: ['projects.qa.view'] }, 'view'), true);
  assert.equal(qaAllowed({ permissions: ['projects.qa.view'] }, 'run'), false);
  assert.equal(qaAllowed({ permissions: ['projects.qa.run'] }, 'view'), true);
  assert.equal(qaAllowed({ permissions: ['projects.qa.run'] }, 'manage'), false);
  assert.equal(qaAllowed({ permissions: ['projects.qa.manage'] }, 'run'), true);
  assert.equal(qaAllowed({ roles: ['admin'] }, 'manage'), true);
  assert.equal(qaAllowed({ roles: ['superuser'] }, 'manage'), true);
  assert.equal(qaAllowed({ isPlatformOwner: true }, 'manage'), true);
});

test('a failure needs a severity from 1 to 4; other verdicts drop it', () => {
  assert.equal(verdictProblem({ result: 'fail' }), 'A failure needs a severity.');
  assert.equal(verdictProblem({ result: 'fail', severity: 5 }), 'A failure needs a severity.');
  assert.equal(verdictProblem({ result: 'fail', severity: 2 }), null);
  assert.equal(verdictProblem({ result: 'pass' }), null);
  assert.equal(verdictProblem({ result: 'pass', notes: 'x'.repeat(5001) }), 'Notes are limited to 5000 characters.');
  assert.deepEqual(normalizeVerdict({ result: 'pass', severity: 3, notes: '  ok  ' }), { result: 'pass', severity: null, notes: 'ok', device: '' });
});

test('drafts: bad storage reads as none, drafts win over saved verdicts, saved ones are pruned', () => {
  assert.deepEqual(parseDrafts(null), {});
  assert.deepEqual(parseDrafts('{oops'), {});
  assert.deepEqual(parseDrafts('{"a":{"result":"nope"}}'), {});
  const drafts = parseDrafts('{"a":{"result":"fail","severity":2,"notes":"n"},"b":{"result":"pass"}}');
  const saved = [{ id: 'r1', criterion_id: 'b', result: 'pass' as const }];
  assert.equal(mergeVerdicts(saved, drafts).a.result, 'fail');
  assert.deepEqual(Object.keys(pruneDrafts(saved, drafts)), ['a']);
});

test('accept is blocked with the pass rule reasons', () => {
  assert.equal(acceptBlockedReason('open', undefined), 'Close the session before deciding.');
  const failing = { accepted: false, score: 50, counts: {}, must_total: 2, must_passed: 1, open_blocking: 1, reasons: ['not every must criterion has passed', 'a blocking failure is open'], criteria: [] };
  assert.equal(acceptBlockedReason('closed', failing), 'The pass rule is not met: not every must criterion has passed; a blocking failure is open.');
  assert.equal(acceptBlockedReason('closed', { ...failing, accepted: true, reasons: [] }), null);
});

test('a ticket can be raised for a failure without a ticket, or retried after a failed one', () => {
  assert.equal(canRaiseTicket('pass', undefined), false);
  assert.equal(canRaiseTicket('fail', undefined), true);
  assert.equal(canRaiseTicket('fail', { id: 'd', criterion_id: 'c', severity: 2, status: 'ticket_failed' }), true);
  assert.equal(canRaiseTicket('fail', { id: 'd', criterion_id: 'c', severity: 2, status: 'ticketed' }), false);
});

test('CSV parsing handles quotes, commas, line breaks and a byte order mark', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","he said ""hi""\nagain"\n\n'), [
    ['a', 'b'],
    ['x, y', 'he said "hi"\nagain'],
  ]);
});

test('criteria import reads CSV and JSON and reports bad rows by number', () => {
  const csv = parseCriteriaImport('Title,Subject Kind,Subject Ref,Weight\nOne,feature,registry.create,must\nTwo,,,could\n,none,,must\nFour,feature,,must');
  assert.equal(csv.criteria.length, 2);
  assert.deepEqual(csv.errors, ['Row 3: a title is required.', 'Row 4: a feature criterion needs the feature code.']);
  assert.equal(csv.criteria[1].subject_kind, 'none');
  assert.equal(csv.criteria[1].weight, 'could');

  const js = parseCriteriaImport('{"criteria":[{"title":"A","weight":"should"},{"title":"B","subject_kind":"task","subject_ref":"x"}]}', true);
  assert.equal(js.criteria.length, 1);
  assert.match(js.errors[0], /platform template/);

  assert.deepEqual(parseCriteriaImport('[1,').errors, ['The JSON could not be read.']);
  assert.deepEqual(parseCriteriaImport('a,b\n1,2').errors, ['The CSV header needs a "title" column.']);
  assert.match(parseCriteriaImport('title,weight\nX,huge').errors[0], /weight must be/);
});

test('helpers: chunks of 500, share link, device text', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(chunk(Array.from({ length: 1001 }), 500).length, 3);
  assert.equal(shareLink('https://projects.example.com/', 'ab c'), 'https://projects.example.com/qa/ab%20c');
  assert.equal(describeDevice('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'), 'Android phone, Chrome');
  assert.equal(describeDevice(''), 'Unknown system computer, browser');
});
