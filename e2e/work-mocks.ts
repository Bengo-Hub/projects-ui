import type { Page, Route } from '@playwright/test';
import { ORG, json } from './qa-mocks';

// Mocks for the sprint 12 work screens (board, drawer, My Work, Gantt, uploads). Add after
// mockTenantApi: Playwright tries the most recently added route first.

export const PROJECT_ID = '66666666-6666-4666-8666-666666666666';
export const ME = '44444444-4444-4444-8444-444444444444';
export const MEMBER = '77777777-7777-4777-8777-777777777777';
export const OUTSIDER = '88888888-8888-4888-8888-888888888888';
export const T1 = 'aaaaaaa1-0000-4000-8000-000000000001';
export const T2 = 'aaaaaaa2-0000-4000-8000-000000000002';
export const T3 = 'aaaaaaa3-0000-4000-8000-000000000003';
/** A subtask of T1. */
export const T4 = 'aaaaaaa4-0000-4000-8000-000000000004';
export const STORAGE_URL = 'https://storage.example.test/upload/abc123';

export const WORK_PERMISSIONS = [
  'projects.projects.view',
  'projects.projects.change',
  'projects.tasks.view',
  'projects.tasks.add',
  'projects.tasks.change',
  'projects.members.view',
  'projects.comments.view',
  'projects.comments.add',
  'projects.comments.change_own',
  'projects.comments.delete_own',
  // No projects.rbac.manage: names come with the member list, comments and activity.
];

const statuses = [
  { key: 'todo', label: 'To do', category: 'todo', order: 0 },
  { key: 'in_progress', label: 'In progress', category: 'in_progress', order: 1 },
  { key: 'review', label: 'In review', category: 'in_progress', order: 2 },
  { key: 'done', label: 'Done', category: 'done', order: 3 },
];

function task(id: string, title: string, status: string, over: Record<string, unknown> = {}) {
  return {
    id,
    tenant_id: '55555555-5555-4555-8555-555555555555',
    project_id: PROJECT_ID,
    title,
    status,
    priority: 'medium',
    created_at: '2026-11-01T08:00:00Z',
    updated_at: '2026-11-10T08:00:00Z',
    edges: { assignees: [{ user_id: ME, is_primary: true }] },
    ...over,
  };
}

interface FileRow {
  id: string;
  task_id?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  url: string;
}

export interface WorkState {
  tasks: ReturnType<typeof task>[];
  statusPatches: { taskId: string; status: string; key: string | null }[];
  datePatches: { taskId: string; body: Record<string, unknown> }[];
  checklistPatches: { taskId: string; body: Record<string, unknown>; key: string | null }[];
  commentPosts: { taskId: string; body: Record<string, unknown>; key: string | null }[];
  /** Every ?parent_id the task list was asked for. */
  parentQueries: string[];
  /** Calls to the role screens' user list; the work screens must never need it. */
  rbacUserCalls: number;
  files: FileRow[];
  deletedFiles: string[];
  uploads: { requested: Record<string, unknown>[]; put: { contentType: string | null; body: number }[]; confirmed: Record<string, unknown>[] };
  conflictOnDates: boolean;
}

export function freshWork(): WorkState {
  return {
    tasks: [
      task(T1, 'Pour foundation slab', 'todo', { start_date: '2026-11-02T00:00:00Z', due_date: '2026-11-06T00:00:00Z', metadata: { checklist: [{ id: 'c1', text: 'Book concrete', done: false }] } }),
      task(T2, 'Order roof trusses', 'in_progress', { edges: { assignees: [{ user_id: ME, is_primary: true }, { user_id: MEMBER, is_primary: false }] } }),
      task(T3, 'Cure slab', 'todo', { start_date: '2026-11-09T00:00:00Z', due_date: '2026-11-12T00:00:00Z' }),
      task(T4, 'Check rebar spacing', 'done', { parent_id: T1 }),
    ],
    statusPatches: [],
    datePatches: [],
    checklistPatches: [],
    commentPosts: [],
    parentQueries: [],
    rbacUserCalls: 0,
    files: [
      { id: 'pf1', file_name: 'site-plan.pdf', file_size: 204800, mime_type: 'application/pdf', uploaded_by: MEMBER, uploaded_at: '2026-11-15T08:00:00Z', url: '' },
      { id: 'tf1', task_id: T1, file_name: 'slab-photo.jpg', file_size: 51200, mime_type: 'image/jpeg', uploaded_by: ME, uploaded_at: '2026-11-14T08:00:00Z', url: '' },
    ],
    deletedFiles: [],
    uploads: { requested: [], put: [], confirmed: [] },
    conflictOnDates: true,
  };
}

/** The checklist PATCH applied the way the API does (enough for the mocks). */
function applyChecklistOp(items: { id: string; text: string; done: boolean }[], op: Record<string, unknown>) {
  const at = items.findIndex((i) => i.id === op.item_id);
  if (op.op === 'add' && at < 0) return [...items, { id: String(op.item_id), text: String(op.text), done: false }];
  if (at < 0) return items;
  if (op.op === 'toggle') return items.map((i, n) => (n === at ? { ...i, done: op.done === true } : i));
  if (op.op === 'rename') return items.map((i, n) => (n === at ? { ...i, text: String(op.text) } : i));
  if (op.op === 'remove') return items.filter((_, n) => n !== at);
  return items;
}

const page1 = (data: unknown[], total = data.length) => ({ data, total, limit: 25, page: 1, hasMore: false });

export async function mockWorkApi(page: Page, s: WorkState) {
  const p = `/api/v1/${ORG}/projects/${PROJECT_ID}`;
  await page.route(new RegExp(`${p}$`), (r) =>
    json(r, { id: PROJECT_ID, name: 'Riverside clinic fit-out', status: 'active', currency: 'KES', owner_id: ME, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-10T08:00:00Z' }),
  );
  await page.route(new RegExp(`${p}/statuses$`), (r) => json(r, { data: statuses }));
  await page.route(new RegExp(`${p}/board-counts$`), (r) => {
    const counts = statuses.map((st) => ({ status: st.key, count: s.tasks.filter((t) => t.status === st.key).length }));
    return json(r, { data: counts });
  });
  // Members carry their name and email (the API's copy of the SSO identity); Olive signed in to
  // projects but is not on this project, so she is never listed.
  await page.route(new RegExp(`${p}/members(\\?.*)?$`), (r) => {
    const data = [
      { id: 'm1', user_id: ME, project_id: PROJECT_ID, role_code: 'owner', joined_at: '2026-11-01T08:00:00Z', name: 'Owner', email: 'owner@acme.test' },
      { id: 'm2', user_id: MEMBER, project_id: PROJECT_ID, role_code: 'member', joined_at: '2026-11-01T08:00:00Z', name: 'Mary Member', email: 'mary@acme.test' },
    ];
    return json(r, { data, total: data.length, limit: 500, page: 1, hasMore: false });
  });
  await page.route(new RegExp(`/api/v1/${ORG}/rbac/users(\\?.*)?$`), (r) => {
    s.rbacUserCalls++;
    return json(r, { data: [{ user_id: OUTSIDER, name: 'Olive Outsider', email: 'olive@acme.test', status: 'active', roles: ['member'] }] });
  });
  // The live stream: says connected and ends; the page reconnects later with backoff.
  await page.route(new RegExp(`${p}/stream$`), (r: Route) =>
    r.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: connected\ndata: {"type":"connected"}\n\n' }),
  );
  await page.route(new RegExp(`${p}/tasks(\\?.*)?$`), (r) => {
    const url = new URL(r.request().url());
    const status = url.searchParams.get('status');
    const parent = url.searchParams.get('parent_id');
    if (parent) s.parentQueries.push(parent);
    let rows = status ? s.tasks.filter((t) => t.status === status) : s.tasks;
    if (parent) rows = rows.filter((t) => t.parent_id === parent);
    return json(r, page1(rows));
  });
  await page.route(new RegExp(`${p}/tasks/[^/]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return json(r, { error: 'not found' }, 404);
    // Mary's comment carries her name; nobody needs the role screens to show it.
    const comments =
      id === T1
        ? [{ id: 'cm1', tenant_id: t.tenant_id, project_id: PROJECT_ID, task_id: T1, user_id: MEMBER, author_name: 'Mary Member', content: '<p>Concrete booked for Monday.</p>', created_at: '2026-11-15T09:00:00Z', updated_at: '2026-11-15T09:00:00Z' }]
        : [];
    return json(r, { ...t, comments, comments_total: comments.length });
  });
  await page.route(new RegExp(`${p}/tasks/[^/]+/activities$`), (r) =>
    json(r, {
      data: [{ id: 'a1', tenant_id: 't', project_id: PROJECT_ID, task_id: T1, user_id: MEMBER, actor_name: 'Mary Member', activity_type: 'task.updated', occurred_at: '2026-11-15T09:00:00Z' }],
    }),
  );
  await page.route(new RegExp(`${p}/tasks/[^/]+/checklist$`), (r) => {
    const id = r.request().url().split('/').slice(-2)[0];
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.checklistPatches.push({ taskId: id, body, key: r.request().headers()['idempotency-key'] ?? null });
    const t = s.tasks.find((x) => x.id === id)!;
    const items = ((t.metadata as { checklist?: { id: string; text: string; done: boolean }[] } | undefined)?.checklist ?? []).slice();
    t.metadata = { ...((t.metadata as Record<string, unknown>) ?? {}), checklist: applyChecklistOp(items, body) };
    return json(r, t);
  });
  await page.route(new RegExp(`${p}/tasks/[^/]+/comments(\\?.*)?$`), (r) => {
    const id = r.request().url().split('/').slice(-2)[0];
    if (r.request().method() !== 'POST') return json(r, page1([]));
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.commentPosts.push({ taskId: id, body, key: r.request().headers()['idempotency-key'] ?? null });
    return json(r, { id: `cm${s.commentPosts.length + 1}`, task_id: id, user_id: ME, author_name: 'Owner', content: body.content, created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z' }, 201);
  });
  await page.route(new RegExp(`${p}/tasks/[^/]+/status$`), (r) => {
    const id = r.request().url().split('/').slice(-2)[0];
    const body = r.request().postDataJSON() as { status: string };
    s.statusPatches.push({ taskId: id, status: body.status, key: r.request().headers()['idempotency-key'] ?? null });
    const t = s.tasks.find((x) => x.id === id)!;
    t.status = body.status;
    return json(r, t);
  });
  await page.route(new RegExp(`${p}/tasks/[^/]+/dates$`), (r) => {
    const id = r.request().url().split('/').slice(-2)[0];
    s.datePatches.push({ taskId: id, body: r.request().postDataJSON() as Record<string, unknown> });
    if (s.conflictOnDates) return json(r, { error: 'schedule conflict', code: 'schedule_conflict', blocking_task_ids: [T1] }, 409);
    return json(r, s.tasks.find((x) => x.id === id));
  });
  await page.route(new RegExp(`${p}/gantt$`), (r) =>
    json(r, {
      data: s.tasks
        .filter((t) => t.start_date)
        .map((t) => ({ ...t, critical: true, edges: { ...t.edges, dependencies: t.id === T3 ? [{ id: 'd1', task_id: T3, depends_on_task_id: T1, dependency_type: 'FS', created_at: '2026-11-01T08:00:00Z' }] : [] } })),
      truncated: false,
      limit: 2000,
      critical_days: 11,
    }),
  );
  await page.route(new RegExp(`${p}/tasks/[^/]+/attachments(\\?.*)?$`), (r) =>
    json(r, { data: s.uploads.confirmed.map((c, i) => ({ id: `f${i}`, file_name: c.file_name, file_size: 12, mime_type: 'text/plain', uploaded_by: ME, uploaded_at: '2026-11-16T08:00:00Z', url: '' })), total: s.uploads.confirmed.length, limit: 20, page: 1, hasMore: false }),
  );
  await page.route(new RegExp(`${p}/attachments/uploads$`), (r) => {
    s.uploads.requested.push(r.request().postDataJSON() as Record<string, unknown>);
    return json(r, {
      key: `projects/t/attachments/${PROJECT_ID}/${T1}/abc123.txt`,
      upload: { url: STORAGE_URL, method: 'PUT', headers: { 'Content-Type': 'text/plain' }, expires_at: '2026-11-16T09:00:00Z' },
      max_bytes: 26214400,
      allowed_types: ['text/plain'],
    });
  });
  await page.route(new RegExp(`${p}/attachments(\\?.*)?$`), (r) => {
    if (r.request().method() !== 'POST') {
      const rows = s.files.filter((f) => !s.deletedFiles.includes(f.id)).map((f) => ({ ...f, tenant_id: 't', project_id: PROJECT_ID }));
      return json(r, { data: rows, total: rows.length, limit: 20, page: 1, hasMore: false });
    }
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.uploads.confirmed.push(body);
    const row = { id: `f${s.uploads.confirmed.length}`, task_id: body.task_id as string | undefined, file_name: String(body.file_name), file_size: 12, mime_type: 'text/plain', uploaded_by: ME, uploaded_at: '2026-11-16T08:00:00Z', url: '' };
    s.files.unshift(row);
    return json(r, row, 201);
  });
  await page.route(new RegExp(`${p}/attachments/(?!uploads$)[^/]+$`), (r) => {
    if (r.request().method() !== 'DELETE') return r.fallback();
    s.deletedFiles.push(r.request().url().split('/').pop()!);
    return r.fulfill({ status: 204, body: '' });
  });
  await page.route(STORAGE_URL, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PUT', 'Access-Control-Allow-Headers': 'Content-Type' } });
    s.uploads.put.push({ contentType: r.request().headers()['content-type'] ?? null, body: r.request().postDataBuffer()?.length ?? 0 });
    return r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
  });
  await page.route(new RegExp(`/api/v1/${ORG}/my-work/counts(\\?.*)?$`), (r) => json(r, { data: { overdue: 1, today: 0, week: 1, later: 0 } }));
  await page.route(new RegExp(`/api/v1/${ORG}/my-work(\\?.*)?$`), (r) => {
    const bucket = new URL(r.request().url()).searchParams.get('bucket');
    const rows =
      bucket === 'overdue'
        ? [task(T1, 'Pour foundation slab', 'todo', { due_date: '2026-11-06T00:00:00Z', edges: { project: { id: PROJECT_ID, name: 'Riverside clinic fit-out' }, assignees: [] } })]
        : bucket === 'week'
          ? [task(T3, 'Cure slab', 'todo', { due_date: '2026-11-19T00:00:00Z', edges: { project: { id: PROJECT_ID, name: 'Riverside clinic fit-out' }, assignees: [] } })]
          : [];
    return json(r, { data: rows, total: rows.length, limit: 50, page: 1, hasMore: false });
  });
}
