import type { BrowserContext, Page, Route } from '@playwright/test';
import { ORG, json } from './qa-mocks';
import { PROJECT_ID } from './work-mocks';

// Mocks for the sprint 14 client portal and the team's client screens. The portal signs in with
// its own saved session (projects-portal-auth-storage), never the staff one.

export const CLIENT_ID = '12121212-1212-4121-8121-121212121212';
export const M_READY = 'bbbbbbb1-0000-4000-8000-000000000001';
export const M_DONE = 'bbbbbbb2-0000-4000-8000-000000000002';
export const CONTACT_ID = 'ccccccc1-0000-4000-8000-000000000001';

const b64url = (s: string) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** An unsigned fixture token for a client: the global role client, scope projects. */
function clientToken(): string {
  const claims = {
    sub: CLIENT_ID,
    roles: ['client'],
    tenant_slug: ORG,
    subscription_status: 'ACTIVE',
    subscription_features: ['project_management', 'client_portal'],
    active_service_tags: ['projects'],
  };
  return `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(claims))}.e2e`; // secret-scan:allow (unsigned fixture token for the mocked portal session)
}

export const clientUser = {
  id: CLIENT_ID,
  email: 'jane@client.test',
  fullName: 'Jane Client',
  roles: ['client'],
  permissions: [] as string[],
  tenant_id: '55555555-5555-4555-8555-555555555555',
  tenant_slug: ORG,
  isPlatformOwner: false,
  isSuperUser: false,
};

/** A saved portal sign-in in the shape the portal store persists. */
export async function signInPortal(context: BrowserContext, baseURL: string) {
  const state = { state: { session: { accessToken: clientToken(), refreshToken: '', expiresAt: new Date(Date.now() + 3600_000).toISOString() }, user: clientUser }, version: 0 };
  await context.addInitScript(
    ([origin, value]) => {
      if (window.location.origin === origin) window.localStorage.setItem('projects-portal-auth-storage', value);
    },
    [new URL(baseURL).origin, JSON.stringify(state)] as const,
  );
}

export interface PortalState {
  emailNotVerified: boolean;
  projects: { id: string; name: string; status: string; start_date: string | null; end_date: string | null }[];
  readyStatus: string;
  /** The next decision answers 409 milestone_not_ready (someone decided first). */
  conflictNextDecision: boolean;
  decisions: { milestoneId: string; body: Record<string, unknown> }[];
  thread: { id: string; content: string; author_id: string; author_name: string; author_kind: 'client' | 'team'; created_at: string; updated_at: string }[];
  posts: { body: Record<string, unknown>; key: string | null }[];
  /** GET /portal/projects/{id} calls: the landing must never make one per card. */
  summaryCalls: number;
}

/** The progress the API puts on each landing card, the same counts as the summary below. */
function progressOf(s: PortalState) {
  return { tasks_total: 10, tasks_done: 4, percent: 40, milestones_total: 2, milestones_done: 1, awaiting_review: s.readyStatus === 'ready_for_review' ? 1 : 0 };
}

export function freshPortal(over: Partial<PortalState> = {}): PortalState {
  return {
    emailNotVerified: false,
    projects: [{ id: PROJECT_ID, name: 'Riverside clinic fit-out', status: 'active', start_date: '2026-11-01T00:00:00Z', end_date: '2027-02-28T00:00:00Z' }],
    readyStatus: 'ready_for_review',
    conflictNextDecision: false,
    decisions: [],
    thread: [
      { id: 'th1', content: '<p>Welcome to the portal. Drawings are under Files.</p>', author_id: '44444444-4444-4444-8444-444444444444', author_name: 'Owner', author_kind: 'team', created_at: '2026-11-15T09:00:00Z', updated_at: '2026-11-15T09:00:00Z' },
    ],
    posts: [],
    summaryCalls: 0,
    ...over,
  };
}

const page1 = (data: unknown[]) => ({ data, total: data.length, limit: 20, page: 1, hasMore: false });

export async function mockPortalApi(page: Page, s: PortalState) {
  await page.route(/\/api\/v1\//, (r) => json(r, page1([])));
  await page.route(/\/api\/v1\/auth\/me$/, (r) => json(r, clientUser));
  await page.route(new RegExp(`/api/v1/tenants/by-slug/${ORG}$`), (r) => json(r, { id: clientUser.tenant_id, name: 'Acme Works', slug: ORG, status: 'active', use_case: 'other' }));
  const base = `/api/v1/${ORG}/portal/projects`;
  await page.route(new RegExp(`${base}(\\?.*)?$`), (r: Route) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Access-Control-Expose-Headers': 'X-Client-Invites',
        ...(s.emailNotVerified ? { 'X-Client-Invites': 'email_not_verified' } : {}),
      },
      body: JSON.stringify(page1(s.emailNotVerified ? [] : s.projects.map((x) => ({ ...x, progress: progressOf(s) })))),
    }),
  );
  const p = `${base}/${PROJECT_ID}`;
  await page.route(new RegExp(`${p}$`), (r) => {
    s.summaryCalls++;
    const pr = progressOf(s);
    return json(r, {
      ...s.projects[0],
      progress: pr.percent,
      total_tasks: pr.tasks_total,
      completed_tasks: pr.tasks_done,
      total_milestones: pr.milestones_total,
      completed_milestones: pr.milestones_done,
      awaiting_review: pr.awaiting_review,
      next_milestone: { id: M_READY, name: 'Ground floor handover', status: s.readyStatus, target_date: '2026-11-30T00:00:00Z' },
    });
  });
  await page.route(new RegExp(`${p}/milestones$`), (r) =>
    json(r, {
      data: [
        { id: M_DONE, name: 'Site survey', description: '', status: 'approved', target_date: '2026-11-05T00:00:00Z', completed_at: null, can_decide: false, last_decision: { decision: 'approved', comment: 'Looks right.', decided_at: '2026-11-06T10:00:00Z', decided_by_name: 'Jane Client' } },
        { id: M_READY, name: 'Ground floor handover', description: '<p>Walls, floors and wiring on the ground floor.</p>', status: s.readyStatus, target_date: '2026-11-30T00:00:00Z', completed_at: null, can_decide: s.readyStatus === 'ready_for_review', last_decision: null },
      ],
    }),
  );
  await page.route(new RegExp(`${p}/milestones/[^/]+/decision$`), (r) => {
    const milestoneId = r.request().url().split('/').slice(-2)[0];
    const body = r.request().postDataJSON() as Record<string, unknown>;
    if (s.conflictNextDecision) {
      s.conflictNextDecision = false;
      s.readyStatus = 'approved';
      return json(r, { error: 'this milestone is not waiting for your review', code: 'milestone_not_ready' }, 409);
    }
    s.decisions.push({ milestoneId, body });
    s.readyStatus = body.decision === 'approve' ? 'approved' : 'changes_requested';
    return json(r, { id: milestoneId, status: s.readyStatus, decision: body.decision });
  });
  await page.route(new RegExp(`${p}/tasks(\\?.*)?$`), (r) =>
    json(r, page1([{ id: 't1', title: 'Pour foundation slab', description: '', status: 'done', status_label: 'Done', start_date: null, due_date: '2026-11-06T00:00:00Z', progress: 100, completed_at: '2026-11-06T00:00:00Z' }])),
  );
  await page.route(new RegExp(`${p}/files(\\?.*)?$`), (r) =>
    json(r, page1([{ id: 'f1', file_name: 'site-plan.pdf', file_size: 204800, mime_type: 'application/pdf', uploaded_at: '2026-11-15T08:00:00Z', task_id: null, url: 'https://storage.example.test/signed/site-plan.pdf' }])),
  );
  await page.route(new RegExp(`${p}/invoices(\\?.*)?$`), (r) => json(r, { data: [], total: 0, page: 1, limit: 20, hasMore: false, available: false, note: 'Invoices will appear here once billing is connected to the portal.' }));
  await page.route(new RegExp(`${p}/thread(\\?.*)?$`), (r) => {
    if (r.request().method() !== 'POST') return json(r, page1(s.thread));
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.posts.push({ body, key: r.request().headers()['idempotency-key'] ?? null });
    const c = { id: `th${s.thread.length + 1}`, content: String(body.content), author_id: CLIENT_ID, author_name: 'Jane Client', author_kind: 'client' as const, created_at: '2026-11-17T09:00:00Z', updated_at: '2026-11-17T09:00:00Z' };
    s.thread.push(c);
    return json(r, c, 201);
  });
}

// Team side (add after mockTenantApi and mockWorkApi).

/** portal.manage alone opens the contact picker (projects-api lets it through /lookups/contacts). */
export const PORTAL_STAFF_PERMISSIONS = ['projects.portal.manage'];

export interface TeamPortalState {
  clients: { id: string; project_id: string; user_id: string | null; crm_contact_id: string; name: string; email_hint: string; status: string; invited_at?: string; activated_at?: string }[];
  invites: Record<string, unknown>[];
  revoked: string[];
  taskShares: { taskId: string; body: Record<string, unknown> }[];
  fileShares: { fileId: string; body: Record<string, unknown> }[];
  thread: PortalState['thread'];
  posts: { body: Record<string, unknown>; key: string | null }[];
}

export function freshTeamPortal(): TeamPortalState {
  return {
    clients: [{ id: 'cl1', project_id: PROJECT_ID, user_id: CLIENT_ID, crm_contact_id: 'ccccccc0-0000-4000-8000-000000000000', name: 'Jane Client', email_hint: 'j***@client.test', status: 'active', invited_at: '2026-11-10T08:00:00Z', activated_at: '2026-11-11T08:00:00Z' }],
    invites: [],
    revoked: [],
    taskShares: [],
    fileShares: [],
    thread: [{ id: 'th1', content: '<p>When is the handover?</p>', author_id: CLIENT_ID, author_name: 'Jane Client', author_kind: 'client', created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z' }],
    posts: [],
  };
}

/** The team's milestone list: one approved, one sent back with the client's comment. */
export function teamMilestones() {
  const base = { tenant_id: '55555555-5555-4555-8555-555555555555', project_id: PROJECT_ID, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-16T08:00:00Z' };
  return [
    { ...base, id: M_DONE, name: 'Site survey', status: 'approved', target_date: '2026-11-05T00:00:00Z', last_decision: { decision: 'approved', comment: 'Looks right.', decided_at: '2026-11-06T10:00:00Z', decided_by_name: 'Jane Client' } },
    { ...base, id: M_READY, name: 'Ground floor handover', status: 'changes_requested', target_date: '2026-11-30T00:00:00Z', last_decision: { decision: 'changes_requested', comment: 'Move the socket by the door.', decided_at: '2026-11-16T10:00:00Z', decided_by_name: 'Jane Client' } },
  ];
}

/** w: the work mocks' state, so a shared task reads back shared like the API's. */
export async function mockTeamPortalApi(page: Page, s: TeamPortalState, w?: { tasks: { id: string; metadata?: unknown }[] }) {
  const p = `/api/v1/${ORG}/projects/${PROJECT_ID}`;
  await page.route(new RegExp(`/api/v1/${ORG}/lookups/contacts(\\?.*)?$`), (r) =>
    json(r, { data: [{ id: CONTACT_ID, name: 'Peter Patron', detail: 'peter@patron.test' }] }),
  );
  await page.route(new RegExp(`${p}/clients$`), (r) => {
    if (r.request().method() !== 'POST') return json(r, { data: s.clients.filter((c) => !s.revoked.includes(c.id)) });
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.invites.push(body);
    const client = { id: `cl${s.clients.length + 1}`, project_id: PROJECT_ID, user_id: null, crm_contact_id: String(body.crm_contact_id), name: 'Peter Patron', email_hint: 'p***@patron.test', status: 'invited', invited_at: '2026-11-17T08:00:00Z' };
    s.clients.push(client);
    return json(r, { client, resent: false }, 201);
  });
  await page.route(new RegExp(`${p}/clients/[^/]+$`), (r) => {
    s.revoked.push(r.request().url().split('/').pop()!);
    return r.fulfill({ status: 204, body: '' });
  });
  await page.route(new RegExp(`${p}/tasks/[^/]+/sharing$`), (r) => {
    const taskId = r.request().url().split('/').slice(-2)[0];
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.taskShares.push({ taskId, body });
    const t = w?.tasks.find((x) => x.id === taskId);
    if (t) t.metadata = { ...((t.metadata as Record<string, unknown> | undefined) ?? {}), client_visible: body.client_visible === true };
    return json(r, { id: taskId, client_visible: body.client_visible === true });
  });
  await page.route(new RegExp(`${p}/attachments/[^/]+/sharing$`), (r) => {
    const fileId = r.request().url().split('/').slice(-2)[0];
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.fileShares.push({ fileId, body });
    return json(r, { id: fileId, file_name: 'site-plan.pdf', metadata: { client_visible: body.client_visible === true }, url: '' });
  });
  await page.route(new RegExp(`${p}/client-thread(\\?.*)?$`), (r) => {
    if (r.request().method() !== 'POST') return json(r, page1(s.thread));
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.posts.push({ body, key: r.request().headers()['idempotency-key'] ?? null });
    const c = { id: `th${s.thread.length + 1}`, content: String(body.content), author_id: '44444444-4444-4444-8444-444444444444', author_name: 'Owner', author_kind: 'team' as const, created_at: '2026-11-17T09:00:00Z', updated_at: '2026-11-17T09:00:00Z' };
    s.thread.push(c);
    return json(r, c, 201);
  });
  await page.route(new RegExp(`${p}/milestones$`), (r) => json(r, { data: teamMilestones() }));
}
