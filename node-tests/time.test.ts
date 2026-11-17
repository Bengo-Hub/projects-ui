import { test } from 'node:test';
import assert from 'node:assert/strict';

const time = await import('../src/lib/work/time.ts');
const queue = await import('../src/lib/work/offline-queue.ts');

test('a timer stop key is fixed per run, whatever device or time format sends it', () => {
  const a = time.timerStopKey({ project_id: 'p1', task_id: 't1', started_at: '2026-11-17T08:00:00+03:00' });
  const b = time.timerStopKey({ project_id: 'p1', task_id: 't1', started_at: '2026-11-17T05:00:00.000Z' });
  assert.equal(a, b);
  assert.equal(a, 'stop:t1:2026-11-17T05:00:00.000Z');
  // A retry after a midnight split starts later, so it is a new stop.
  assert.notEqual(a, time.timerStopKey({ project_id: 'p1', task_id: 't1', started_at: '2026-11-17T21:00:00.000Z' }));
  // A run on the project itself (no task) keys on the project.
  assert.equal(time.timerStopKey({ project_id: 'p1', started_at: '2026-11-17T05:00:00Z' }), 'stop:p1:2026-11-17T05:00:00.000Z');
  assert.ok(a.length <= 128);
});

test('week maths: Monday to Sunday, across months and years', () => {
  assert.equal(time.mondayOf('2026-11-17'), '2026-11-16'); // a Tuesday
  assert.equal(time.mondayOf('2026-11-16'), '2026-11-16'); // a Monday
  assert.equal(time.mondayOf('2026-11-22'), '2026-11-16'); // a Sunday stays in its week
  assert.equal(time.mondayOf('2027-01-01'), '2026-12-28');
  assert.deepEqual(time.weekDays('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(time.addDays('2026-11-16', -7), '2026-11-09');
  assert.equal(time.weekLabel('2026-11-16'), '16 Nov to 22 Nov 2026');
  assert.equal(time.dayName('2026-11-16'), 'Mon 16');
  assert.equal(time.isYmd('2026-11-17'), true);
  assert.equal(time.isYmd('17/11/2026'), false);
});

test('today and midnight follow the zone, not the machine', () => {
  const at = new Date('2026-11-16T22:30:00Z');
  assert.equal(time.todayIn('Africa/Nairobi', at), '2026-11-17'); // 01:30 in Nairobi
  assert.equal(time.todayIn('UTC', at), '2026-11-16');
  assert.equal(time.zonedMidnight('2026-11-17', 'Africa/Nairobi').toISOString(), '2026-11-16T21:00:00.000Z');
  assert.equal(time.zonedMidnight('2026-11-17', 'UTC').toISOString(), '2026-11-17T00:00:00.000Z');
});

test('hours: decimals and h:mm in, rounded to two places, 0 to 24', () => {
  assert.deepEqual(time.parseHours(''), { ok: true, hours: 0 });
  assert.deepEqual(time.parseHours('1.5'), { ok: true, hours: 1.5 });
  assert.deepEqual(time.parseHours('1,25'), { ok: true, hours: 1.25 });
  assert.deepEqual(time.parseHours('1:30'), { ok: true, hours: 1.5 });
  assert.deepEqual(time.parseHours('0:20'), { ok: true, hours: 0.33 });
  assert.deepEqual(time.parseHours('.5'), { ok: true, hours: 0.5 });
  assert.equal(time.parseHours('25').ok, false);
  assert.equal(time.parseHours('abc').ok, false);
  assert.equal(time.parseHours('1:75').ok, false);
  assert.equal(time.parseHours('-1').ok, false);
  assert.equal(time.formatHours(0), '');
  assert.equal(time.formatHours(1.5), '1.5');
  assert.equal(time.formatHours(8), '8');
  assert.equal(time.formatTotal(0), '0');
  assert.equal(time.formatTotal(7.456), '7.46');
});

test('elapsed time reads m:ss under an hour and h:mm:ss after', () => {
  assert.equal(time.formatElapsed(0), '0:00');
  assert.equal(time.formatElapsed(65_000), '1:05');
  assert.equal(time.formatElapsed(3_600_000 + 2 * 60_000 + 3_000), '1:02:03');
  assert.equal(time.formatElapsed(-5), '0:00');
  assert.equal(time.elapsedMs('2026-11-17T08:00:00Z', Date.parse('2026-11-17T08:00:10Z')), 10_000);
  assert.equal(time.elapsedMs('junk', 1000), 0);
});

function week(): import('../src/lib/work/time.ts').TimeWeek {
  const days = time.weekDays('2026-11-16');
  return {
    week_start: days[0],
    week_end: days[6],
    days,
    status: 'draft',
    editable: true,
    timesheets: [],
    rows: [
      { project_id: 'p1', project_name: 'Clinic', task_id: 't1', task_title: 'Slab', billable: true, hours: { '2026-11-16': 2, '2026-11-17': 3 }, total: 5 },
      { project_id: 'p2', project_name: 'Office', task_id: null, billable: false, hours: { '2026-11-16': 1 }, total: 1 },
    ],
    day_totals: { '2026-11-16': 3, '2026-11-17': 3 },
    total: 6,
    billable_total: 5,
  };
}

test('totals: by day, by row, the week and the billable part', () => {
  const w = week();
  const t = time.weekTotals(w.rows, w.days);
  assert.equal(t.total, 6);
  assert.equal(t.billable_total, 5);
  assert.equal(t.day_totals['2026-11-16'], 3);
  assert.equal(t.day_totals['2026-11-22'], 0);
});

test('applyEntry sets a cell, adds a new row and recounts everything', () => {
  let w = time.applyEntry(week(), { project_id: 'p1', task_id: 't1', date: '2026-11-17', hours: 1.5, note: 'Formwork' });
  assert.equal(w.rows[0].hours['2026-11-17'], 1.5);
  assert.equal(w.rows[0].total, 3.5);
  assert.equal(w.rows[0].notes?.['2026-11-17'], 'Formwork');
  assert.equal(w.total, 4.5);
  assert.equal(w.billable_total, 3.5);
  w = time.applyEntry(w, { project_id: 'p3', date: '2026-11-18', hours: 4, billable: true }, { project_name: 'Roads' });
  assert.equal(w.rows.length, 3);
  assert.equal(w.rows[2].project_name, 'Roads');
  assert.equal(w.rows[2].task_id, null);
  assert.equal(w.total, 8.5);
  assert.equal(w.billable_total, 7.5);
  // A date outside the week changes nothing.
  assert.equal(time.applyEntry(w, { project_id: 'p1', date: '2026-11-30', hours: 3 }), w);
  // An empty note removes the note.
  w = time.applyEntry(w, { project_id: 'p1', task_id: 't1', date: '2026-11-17', hours: 1.5, note: '' });
  assert.equal(w.rows[0].notes?.['2026-11-17'], undefined);
});

test('draft rows join the week once, and the billable switch re-sends only logged days', () => {
  const w = week();
  const merged = time.withDraftRows(w, [time.draftRow('p1', 'Clinic', true, 't1', 'Slab'), time.draftRow('p9', 'New', false)]);
  assert.equal(merged.rows.length, 3);
  assert.equal(merged.rows[2].project_id, 'p9');
  assert.equal(time.withDraftRows(w, []), w);
  assert.deepEqual(time.loggedDays(w.rows[0], w.days), ['2026-11-16', '2026-11-17']);
});

test('status and billing rules', () => {
  assert.equal(time.canSubmitWeek({ editable: true, total: 6, status: 'draft' }), true);
  assert.equal(time.canSubmitWeek({ editable: true, total: 0, status: 'draft' }), false);
  assert.equal(time.canSubmitWeek({ editable: false, total: 6, status: 'submitted' }), false);
  assert.equal(time.canSubmitWeek({ editable: true, total: 6, status: 'rejected' }), true);
  assert.equal(time.billsHours({ billing_type: 'time_and_materials' }), true);
  assert.equal(time.billsHours({ billing_type: 'fixed' }), false);
  assert.equal(time.billsHours(undefined), false);
});

test('errors: the API code and the segments a partial stop logged', () => {
  assert.equal(time.timeErrorCode({ response: { data: { code: 'no_employee_record' } } }), 'no_employee_record');
  assert.equal(time.timeErrorCode(new Error('Network Error')), undefined);
  const err = { response: { status: 502, data: { code: 'erp_unavailable', logged_segments: [{ date: '2026-11-16', hours: 1.5 }, { date: 'x', hours: 1 }] } } };
  assert.deepEqual(time.loggedSegments(err), [{ date: '2026-11-16', hours: 1.5 }]);
  assert.deepEqual(time.loggedSegments({}), []);
});

test('the running timer: read from the API or the browser copy, junk ignored', () => {
  const t = { project_id: 'p1', task_id: 't1', task_title: 'Slab', started_at: '2026-11-17T08:00:00.123456789Z' };
  assert.deepEqual(time.readTimer(t), t);
  assert.equal(time.readTimer(null), null);
  assert.equal(time.readTimer([]), null); // a mocked list answer is not a timer
  assert.equal(time.readTimer({ ...t, started_at: 'soon' }), null);
  assert.equal(time.sameStart('2026-11-17T08:00:00.123456789Z', '2026-11-17T08:00:00.123Z'), true);
  assert.equal(time.sameStart('2026-11-17T08:00:00Z', '2026-11-17T08:00:01Z'), false);
});

test('a partial stop across midnight resumes at the next midnight in its zone', () => {
  const start = '2026-11-16T19:00:00Z'; // 22:00 in Nairobi on the 16th
  assert.equal(time.remainingStart(start, [{ date: '2026-11-16', hours: 2 }], 'Africa/Nairobi'), '2026-11-16T21:00:00.000Z');
  assert.equal(time.remainingStart(start, [], 'Africa/Nairobi'), start);
});

test('queue keys: one per cell and user, one per timer run', () => {
  assert.equal(time.entryQueueKey({ project_id: 'p1', task_id: 't1', date: '2026-11-17' }), 'time-entry:me:p1:t1:2026-11-17');
  assert.equal(time.entryQueueKey({ project_id: 'p1', date: '2026-11-17', user_id: 'u2' }), 'time-entry:u2:p1:-:2026-11-17');
  assert.equal(time.stopQueueKey('t1', '2026-11-17T08:00:00Z'), 'timer-stop:t1:2026-11-17T08:00:00Z');
});

test('the offline queue keeps the last edit of a cell, one stop per run, and a week of time', () => {
  const base = { orgSlug: 'acme', projectId: 'p1', createdAt: 1000, attempts: 0 };
  const entry = (hours: number) => ({
    ...base,
    kind: 'time-entry' as const,
    key: time.entryQueueKey({ project_id: 'p1', date: '2026-11-17' }),
    taskId: '',
    entry: { project_id: 'p1', date: '2026-11-17', hours },
  });
  const stop = {
    ...base,
    kind: 'timer-stop' as const,
    key: time.stopQueueKey('t1', '2026-11-17T08:00:00Z'),
    taskId: 't1',
    stop: { project_id: 'p1', task_id: 't1', started_at: '2026-11-17T08:00:00Z', stopped_at: '2026-11-17T09:00:00Z' },
    timerStartedAt: '2026-11-17T08:00:00Z',
    tz: 'Africa/Nairobi',
  };
  let q = queue.enqueue([], entry(2));
  q = queue.enqueue(q, entry(3));
  q = queue.enqueue(q, stop);
  q = queue.enqueue(q, { ...stop, stop: { ...stop.stop, stopped_at: '2026-11-17T09:05:00Z' } });
  assert.equal(q.length, 2);
  assert.equal(queue.pendingTimeEntries(q, 'acme')[0].entry.hours, 3);
  assert.equal(queue.pendingTimeEntries(q, 'acme', 'someone-else').length, 0);
  assert.equal(queue.pendingStops(q, 'acme').length, 1);
  const moved = queue.replaceEdit(q, { ...stop, stop: { ...stop.stop, started_at: '2026-11-17T21:00:00Z' } });
  assert.equal(queue.pendingStops(moved, 'acme')[0].stop.started_at, '2026-11-17T21:00:00Z');

  const back = queue.deserialize(queue.serialize(q));
  assert.deepEqual(back, q);
  // Time waits a week; task edits a day.
  assert.equal(queue.prune(back, 1000 + queue.QUEUE_MAX_AGE_MS + 1).length, 2);
  assert.equal(queue.prune(back, 1000 + queue.TIME_QUEUE_MAX_AGE_MS + 1).length, 0);
  // Malformed time edits are dropped on load.
  const bad = [{ ...entry(30) }, { ...stop, stop: { project_id: 'p1' } }, { ...stop, tz: '' }];
  assert.deepEqual(queue.deserialize(JSON.stringify(bad)), []);
});
