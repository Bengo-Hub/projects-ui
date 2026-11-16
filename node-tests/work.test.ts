import { test } from 'node:test';
import assert from 'node:assert/strict';

const checklist = await import('../src/lib/work/checklist.ts');
const queue = await import('../src/lib/work/offline-queue.ts');
const gantt = await import('../src/lib/work/gantt.ts');
const sse = await import('../src/lib/work/sse.ts');
const calendar = await import('../src/lib/work/calendar.ts');
const filters = await import('../src/lib/work/saved-filters.ts');
const people = await import('../src/lib/work/people.ts');
const files = await import('../src/lib/work/files.ts');

test('people: names come from the member row, then the email, then a short id', () => {
  const id = '77777777-7777-4777-8777-777777777777';
  assert.equal(people.personLabel({ userId: id, name: ' Mary Member ', email: 'mary@acme.test' }), 'Mary Member');
  assert.equal(people.personLabel({ userId: id, name: '', email: 'mary@acme.test' }), 'mary@acme.test');
  assert.equal(people.personLabel({ userId: id, isMe: true }), 'You');
  assert.equal(people.personLabel({ userId: id }), 'Member 77777777');
  assert.equal(people.personLabel({ userId: id, former: true }), 'Former member 77777777');
  assert.equal(people.initials('Mary Wanjiru Member'), 'MM');
  assert.equal(people.initials('mary@acme.test'), 'MT');
  assert.equal(people.initials(''), '?');
});

test('files: sizes read in B, KB and MB; a task file links to its task', () => {
  assert.equal(files.fileSize(512), '512 B');
  assert.equal(files.fileSize(51200), '50 KB');
  assert.equal(files.fileSize(5 * 1024 * 1024), '5.0 MB');
  assert.deepEqual(files.filePlace({}, 'acme', 'p1', () => 'x'), { label: 'Project', href: null });
  assert.deepEqual(files.filePlace({ task_id: 't1' }, 'acme', 'p1', (id) => (id === 't1' ? 'Pour slab' : undefined)), {
    label: 'Pour slab',
    href: '/acme/projects/p1/tasks?task=t1',
  });
  assert.equal(files.filePlace({ task_id: 't9' }, 'acme', 'p1', () => undefined).label, 'A task');
});

test('gantt layout: before the width is known both render and CSS picks, so a desktop paints the chart first', () => {
  const unknown = gantt.ganttLayout(undefined, false);
  assert.deepEqual([unknown.mountChart, unknown.mountList], [true, true]);
  assert.equal(unknown.chartClass, 'hidden sm:block');
  assert.equal(unknown.listClass, 'sm:hidden');
  const desktop = gantt.ganttLayout(true, false);
  assert.deepEqual([desktop.mountChart, desktop.mountList], [true, false]);
  const phone = gantt.ganttLayout(false, false);
  assert.deepEqual([phone.mountChart, phone.mountList], [false, true]);
  const phoneChart = gantt.ganttLayout(false, true);
  assert.deepEqual([phoneChart.mountChart, phoneChart.mountList, phoneChart.chartClass], [true, false, '']);
});

test('checklist: reads only well formed items; an operation leaves the rest of the metadata alone', () => {
  const meta = {
    owner_note: 'keep me',
    checklist: [{ id: 'a', text: 'Order steel', done: true }, { id: 'a', text: 'dup', done: false }, { text: 'no id' }, 'junk', { id: 'b', text: 'Pour slab' }],
  };
  const items = checklist.readChecklist(meta);
  assert.deepEqual(items, [
    { id: 'a', text: 'Order steel', done: true },
    { id: 'b', text: 'Pour slab', done: false },
  ]);
  const next = checklist.metadataWithOp(meta, checklist.toggleOp(items[1]));
  assert.equal(next.owner_note, 'keep me');
  assert.deepEqual(checklist.checklistProgress(checklist.readChecklist(next)), { done: 2, total: 2, pct: 100 });
});

test('checklist: typed text becomes add and rename operations; blanks send nothing or remove', () => {
  assert.equal(checklist.addOp('   ', 'x'), null);
  assert.deepEqual(checklist.addOp('  Snag list  ', 'x'), { op: 'add', item_id: 'x', text: 'Snag list' });
  const item = { id: 'x', text: 'Snag list', done: false };
  assert.deepEqual(checklist.renameOp(item, 'Snags'), { op: 'rename', item_id: 'x', text: 'Snags' });
  assert.equal(checklist.renameOp(item, ' Snag list '), null, 'an unchanged text sends nothing');
  assert.deepEqual(checklist.renameOp(item, '  '), { op: 'remove', item_id: 'x' });
  assert.deepEqual(checklist.toggleOp(item), { op: 'toggle', item_id: 'x', done: true }, 'a tick names the state, never "flip"');
  assert.match(checklist.newItemId(() => 0.5), /^[A-Za-z0-9_-]{1,64}$/);
  assert.deepEqual(checklist.checklistProgress([]), { done: 0, total: 0, pct: 0 });
});

test('checklist: operations apply as on the API, and applying one twice changes nothing more', () => {
  const ids = (l: { id: string }[]) => l.map((i) => i.id).join(',');
  const base = [
    { id: 'a', text: 'Dig', done: false },
    { id: 'b', text: 'Pour', done: false },
    { id: 'c', text: 'Cure', done: true },
  ];
  const ops = [
    { op: 'add', item_id: 'x', text: 'Mark', position: 1 },
    { op: 'toggle', item_id: 'a', done: true },
    { op: 'rename', item_id: 'b', text: 'Pour slab' },
    { op: 'remove', item_id: 'c' },
    { op: 'reorder', item_id: 'a', position: 9 },
  ] as const;
  let once = base;
  for (const op of ops) once = checklist.applyOp(once, op);
  assert.equal(ids(once), 'x,b,a');
  assert.deepEqual(once.find((i) => i.id === 'a'), { id: 'a', text: 'Dig', done: true });
  // The drawer re-applies queued operations over a list that may already hold them.
  let twice = once;
  for (const op of ops) twice = checklist.applyOp(twice, op);
  assert.deepEqual(twice, once);
  assert.equal(checklist.applyOp(base, { op: 'toggle', item_id: 'gone', done: true }), base, 'an unknown item is left alone');
  assert.equal(ids(base), 'a,b,c', 'the input is never changed');
});

const edit = (over: Record<string, unknown>) => ({ orgSlug: 'acme', projectId: 'p1', taskId: 't1', createdAt: 1000, attempts: 0, ...over });

test('offline queue: a newer status of a task replaces the waiting one; comments and checklist operations stack', () => {
  let q = queue.enqueue([], edit({ kind: 'status', key: 'k1', status: 'in_progress' }) as never);
  q = queue.enqueue(q, edit({ kind: 'comment', key: 'c1', content: '<p>one</p>' }) as never);
  q = queue.enqueue(q, edit({ kind: 'checklist', key: 'l1', op: { op: 'toggle', item_id: 'a', done: true } }) as never);
  q = queue.enqueue(q, edit({ kind: 'comment', key: 'c2', content: '<p>two</p>' }) as never);
  q = queue.enqueue(q, edit({ kind: 'checklist', key: 'l2', op: { op: 'add', item_id: 'b', text: 'Snag' } }) as never);
  q = queue.enqueue(q, edit({ kind: 'status', key: 'k2', status: 'done' }) as never);
  q = queue.enqueue(q, edit({ kind: 'status', key: 'k3', status: 'review', taskId: 't2' }) as never);
  assert.deepEqual(q.map((e) => e.key), ['c1', 'l1', 'c2', 'l2', 'k2', 'k3']);
  assert.deepEqual(queue.pendingChecklistOps(q, 't1').map((o) => o.op), ['toggle', 'add']);
  assert.deepEqual(queue.pendingChecklistOps(q, 't2'), []);
  assert.equal(queue.pendingStatus(q, 't1'), 'done');
  assert.equal(queue.pendingStatus(q, 't9'), undefined);
  q = queue.dequeue(q, 'c1');
  q = queue.markAttempt(q, 'c2');
  assert.equal(q.find((e) => e.key === 'c2')?.attempts, 1);
});

test('offline queue: survives a reload, drops malformed and expired entries', () => {
  const q = [edit({ kind: 'status', key: 'k1', status: 'done' }), edit({ kind: 'checklist', key: 'k2', op: { op: 'remove', item_id: 'a' } })] as never[];
  const back = queue.deserialize(queue.serialize(q));
  assert.equal(back.length, 2);
  // A checklist entry must hold a well formed operation (a whole-list write is never replayed).
  const stale = [edit({ kind: 'checklist', key: 'k3', metadata: { checklist: [] } }), edit({ kind: 'checklist', key: 'k4', op: { op: 'toggle', item_id: 'a' } })];
  assert.deepEqual(queue.deserialize(JSON.stringify(stale)), []);
  assert.deepEqual(queue.deserialize('{not json'), []);
  assert.deepEqual(queue.deserialize(JSON.stringify([{ kind: 'status', key: 'x' }, { kind: 'nope', key: 'y', orgSlug: 'a', projectId: 'b', taskId: 'c', createdAt: 1 }])), []);
  assert.equal(queue.prune(back, 1000 + queue.QUEUE_MAX_AGE_MS + 1).length, 0);
  assert.equal(queue.prune(back, 2000).length, 2);
});

test('offline queue: only no answer, timeouts, 429 and 5xx stay queued', () => {
  assert.equal(queue.isRetryable(new Error('Network Error')), true);
  assert.equal(queue.isRetryable({ response: { status: 503 } }), true);
  assert.equal(queue.isRetryable({ response: { status: 429 } }), true);
  assert.equal(queue.isRetryable({ response: { status: 400 } }), false);
  assert.equal(queue.isRetryable({ response: { status: 404 } }), false);
});

const t = (id: string, start?: string, due?: string, critical = false, deps: string[] = []) => ({
  id,
  title: id.toUpperCase(),
  status: 'todo',
  start_date: start,
  due_date: due,
  critical,
  edges: { dependencies: deps.map((d) => ({ depends_on_task_id: d, dependency_type: 'FS' })) },
});

test('gantt: rows order by start, bars span start to due, undated rows have no bar', () => {
  const rows = gantt.orderRows([t('c'), t('b', '2026-11-10T00:00:00Z', '2026-11-12'), t('a', '2026-11-01', '2026-11-03')]);
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c']);
  const bars = gantt.layoutBars(rows);
  assert.equal(bars.length, 2);
  assert.equal(bars[1].end - bars[1].start, 2);
  assert.deepEqual(gantt.barSpan(t('m', undefined, '2026-11-05')), { start: gantt.toDay('2026-11-05'), end: gantt.toDay('2026-11-05'), milestone: true });
});

test('gantt: arrows run finish to start and are critical only between critical tasks', () => {
  const rows = [t('a', '2026-11-01', '2026-11-03', true), t('b', '2026-11-04', '2026-11-06', true, ['a']), t('c', '2026-11-04', '2026-11-05', false, ['a'])];
  const bars = gantt.layoutBars(rows);
  const from = gantt.toDay('2026-11-01')!;
  const arrows = gantt.dependencyArrows(rows, bars, from, 10);
  assert.equal(arrows.length, 2);
  const ab = arrows.find((a) => a.toId === 'b')!;
  assert.equal(ab.critical, true);
  assert.equal(ab.points[0][0], 30, 'starts after the predecessor’s last day');
  assert.equal(ab.points[3][0], 30, 'ends at the successor’s first day');
  assert.equal(arrows.find((a) => a.toId === 'c')!.critical, false);
});

test('gantt: critical path summary and the conflict message name the blocking tasks', () => {
  assert.match(gantt.criticalSummary([t('a', undefined, undefined, true), t('b', undefined, undefined, true), t('c')], 9), /2 tasks over 9 days/);
  assert.match(gantt.criticalSummary([t('a')], 0), /No critical path yet/);
  const titles: Record<string, string> = { x: 'Pour slab', y: 'Cure slab' };
  assert.equal(
    gantt.conflictMessage(['x'], (id) => titles[id]),
    'That date would start this task before "Pour slab" finishes. Move it first or pick a later date.',
  );
  assert.match(gantt.conflictMessage(['x', 'y', 'z'], (id) => titles[id]), /"Pour slab", "Cure slab" and "a task outside this view" finish/);
});

test('gantt: dragging moves both dates, resizing stops at the other end', () => {
  const task = t('a', '2026-11-01', '2026-11-03');
  assert.deepEqual(gantt.draggedDates(task, 2, 'move'), { start_date: '2026-11-03', due_date: '2026-11-05' });
  assert.deepEqual(gantt.draggedDates(task, 5, 'start'), { start_date: '2026-11-03' });
  assert.deepEqual(gantt.draggedDates(task, -5, 'end'), { due_date: '2026-11-01' });
  assert.equal(gantt.draggedDates(task, 0, 'move'), null);
  assert.deepEqual(gantt.draggedDates(t('m', undefined, '2026-11-05'), 1, 'move'), { due_date: '2026-11-06' });
});

test('sse: parses complete messages, keeps the tail, skips heartbeats', () => {
  const r = sse.parseSSE('event: connected\ndata: {}\n\n: heartbeat\n\nevent: task.moved\r\ndata: {"type":"task.moved","task_id":"t1"}\r\n\r\nevent: task.upd');
  assert.deepEqual(r.messages, [
    { event: 'connected', data: '{}' },
    { event: 'task.moved', data: '{"type":"task.moved","task_id":"t1"}' },
  ]);
  assert.equal(r.rest, 'event: task.upd');
  assert.equal(sse.staleScopesFor({ type: 'task.moved', project_id: 'p', task_id: 't1' }).board, true);
  assert.equal(sse.staleScopesFor({ type: 'comment.created', project_id: 'p', task_id: 't1' }).comments, 't1');
  assert.equal(sse.backoffMs(0, () => 1), 1000);
  assert.equal(sse.backoffMs(10, () => 1), 30000);
});

test('calendar: Monday-first grids and the fetched window', () => {
  const day = calendar.parseYmd('2026-11-16')!; // a Monday
  assert.equal(calendar.ymd(calendar.weekStart(day + 3)), '2026-11-16');
  const grid = calendar.monthGrid(day);
  assert.equal(grid.length, 42);
  assert.equal(calendar.ymd(grid[0]), '2026-10-26');
  assert.deepEqual(calendar.rangeFor('week', day), { due_from: '2026-11-16', due_to: '2026-11-22' });
  assert.deepEqual(calendar.rangeFor('agenda', day), { due_from: '2026-11-01', due_to: '2026-11-30' });
  assert.equal(calendar.ymd(calendar.shiftAnchor(day, 'month', 1)), '2026-12-01');
  const grouped = calendar.byDueDay([{ due_date: '2026-11-16T00:00:00Z' }, { due_date: '2026-11-16' }, {}]);
  assert.equal(grouped.get(day)?.length, 2);
});

test('saved filters: parse tolerates junk, names replace older entries', () => {
  assert.deepEqual(filters.parseFilterState('nope'), { current: {}, saved: [] });
  let s = filters.parseFilterState(JSON.stringify({ current: { assignee: 'me', priority: 5 }, saved: [{ name: ' ' }, { name: 'Mine', filters: { assignee: 'me' } }] }));
  assert.deepEqual(s.current, { status: undefined, priority: undefined, assignee: 'me' });
  assert.equal(s.saved.length, 1);
  s = filters.saveNamed({ ...s, current: { priority: 'high' } }, 'Mine');
  assert.deepEqual(s.saved, [{ name: 'Mine', filters: { priority: 'high' } }]);
  assert.equal(filters.removeNamed(s, 'Mine').saved.length, 0);
  assert.equal(filters.activeCount({ status: 'done', assignee: 'me' }), 2);
});
