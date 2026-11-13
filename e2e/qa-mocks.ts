import type { BrowserContext, Page, Route } from '@playwright/test';

// Mocks for the QA and acceptance specs. Routes match by path, so they work whatever
// NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SSO_URL the build was made with.

export const ORG = 'acme';
export const CODE = 'k7m2qx9p';
export const SESSION_ID = '11111111-1111-4111-8111-111111111111';
export const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';
export const C1 = '33333333-3333-4333-8333-333333333331';
export const C2 = '33333333-3333-4333-8333-333333333332';

export const criteria = [
  { id: C1, area_code: 'OWN', title: 'Owner can create a registry', subject_kind: 'feature', subject_ref: 'registry.create', weight: 'must', steps: 'Sign in and create a registry', expected_result: 'The registry is listed', sort_order: 10 },
  { id: C2, area_code: 'REG', title: 'Guest sees the gift list', subject_kind: 'none', weight: 'should', sort_order: 20 },
];

export function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const PDF = '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF';

export interface InviteeState {
  signedIn: boolean;
  role: 'tester' | 'signer' | 'observer';
  status: 'open' | 'closed';
  results: { id: string; criterion_id: string; result: string; severity?: number; notes?: string }[];
  puts: { criterionId: string; body: Record<string, unknown> }[];
  otpSends: number;
  failNextPut?: boolean;
}

export function freshInvitee(over: Partial<InviteeState> = {}): InviteeState {
  return { signedIn: false, role: 'tester', status: 'open', results: [], puts: [], otpSends: 0, ...over };
}

/** The invitee routes of projects-api and auth-api's email code. */
export async function mockInviteeApi(page: Page, s: InviteeState) {
  await page.route(/\/api\/v1\/auth\/public-otp\/send$/, (r) => {
    s.otpSends++;
    return json(r, { sent: true });
  });
  await page.route(/\/api\/v1\/auth\/public-otp\/verify$/, (r) => {
    const body = r.request().postDataJSON() as { otp?: string };
    return body.otp === '123456' ? json(r, { verified: true, otp_token: 'otp-token-1' }) : json(r, { error: 'invalid_otp', message: 'That code is not right.' }, 400);
  });
  // Playwright tries the most recently added route first, so the unknown-code answer goes first.
  await page.route(/\/api\/v1\/qa\/access\/[^/]+$/, (r) => json(r, { error: 'not found' }, 404));
  await page.route(new RegExp(`/api/v1/qa/access/${CODE}$`), (r) => json(r, { tenant_slug: ORG, methods: ['sso', 'email_code'] }));
  await page.route(new RegExp(`/api/v1/qa/access/${CODE}/email$`), (r) => {
    const body = r.request().postDataJSON() as { otp_token?: string };
    if (body.otp_token !== 'otp-token-1') return json(r, { error: 'access denied' }, 403);
    s.signedIn = true;
    return json(r, { access_token: 'qa-token', expires_at: new Date(Date.now() + 3600_000).toISOString(), session_id: SESSION_ID, role: s.role });
  });
  await page.route(/\/api\/v1\/qa\/invitee\/session$/, (r) => {
    if (!s.signedIn) return json(r, { error: 'sign in with your invited email first' }, 401);
    const outcome = {
      accepted: false,
      score: 60,
      counts: { pass: 1, fail: 0, blocked: 0, not_run: 1 },
      must_total: 1,
      must_passed: 1,
      open_blocking: 0,
      reasons: ['the weighted score is below the threshold'],
      criteria: criteria.map((c, i) => ({ id: c.id, area_code: c.area_code, title: c.title, weight: c.weight, status: i === 0 ? 'pass' : 'not_run', testers: i === 0 ? 1 : 0 })),
    };
    return json(r, {
      session_id: SESSION_ID,
      title: 'Hadia acceptance',
      status: s.status,
      role: s.role,
      criteria,
      my_results: s.results,
      ...(s.role === 'tester' ? {} : { outcome }),
    });
  });
  await page.route(/\/api\/v1\/qa\/invitee\/results\/[^/]+$/, (r) => {
    const criterionId = r.request().url().split('/').pop() ?? '';
    const body = r.request().postDataJSON() as Record<string, unknown>;
    if (s.failNextPut) {
      s.failNextPut = false;
      return r.abort('internetdisconnected');
    }
    s.puts.push({ criterionId, body });
    const result = { id: `r${s.puts.length}`, criterion_id: criterionId, result: body.result as string, severity: body.severity as number | undefined, notes: body.notes as string };
    s.results = [...s.results.filter((x) => x.criterion_id !== criterionId), result];
    return json(r, { result });
  });
  await page.route(/\/api\/v1\/qa\/invitee\/report\.pdf$/, (r) => r.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }));
  await page.route(/\/api\/v1\/qa\/invitee\/logout$/, (r) => {
    s.signedIn = false;
    return r.fulfill({ status: 204 });
  });
}

// Tenant side.

export interface TenantState {
  permissions: string[];
  sessionStatus: 'draft' | 'open' | 'closed' | 'accepted' | 'rejected';
  accepted: boolean;
  decisions: { decision: string; reason: string }[];
  invites: { email: string; name?: string; role: string }[];
  raised: string[];
  imported: number;
}

export function freshTenant(over: Partial<TenantState> = {}): TenantState {
  return { permissions: ['projects.qa.manage'], sessionStatus: 'closed', accepted: false, decisions: [], invites: [], raised: [], imported: 0, ...over };
}

/** A saved sign-in in the shape the zustand auth store persists, so no SSO round trip happens. */
export async function signIn(context: BrowserContext, baseURL: string, permissions: string[]) {
  const user = {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'owner@acme.test',
    fullName: 'Owner',
    roles: ['member'],
    permissions,
    tenant_id: '55555555-5555-4555-8555-555555555555',
    tenant_slug: ORG,
    isPlatformOwner: false,
    isSuperUser: false,
  };
  const state = { state: { session: { accessToken: 'e2e.token.sig', refreshToken: '', expiresAt: new Date(Date.now() + 3600_000).toISOString() }, user }, version: 0 }; // secret-scan:allow (fake fixture token for the mocked SSO session)
  await context.addInitScript(
    ([origin, value]) => {
      if (window.location.origin === origin) window.localStorage.setItem('projects-auth-storage', value);
    },
    [new URL(baseURL).origin, JSON.stringify(state)] as const,
  );
  return user;
}

export async function mockTenantApi(page: Page, s: TenantState, user: Awaited<ReturnType<typeof signIn>>) {
  // Anything not mocked below answers an empty success, so shell widgets never hang a test.
  await page.route(/\/api\/v1\//, (r) => json(r, { data: [], total: 0 }));
  await page.route(/\/api\/v1\/auth\/me$/, (r) => json(r, { ...user, permissions: s.permissions }));
  const q = `/api/v1/${ORG}/qa`;
  const session = () => ({
    id: SESSION_ID,
    title: 'Hadia acceptance',
    status: s.sessionStatus,
    subject_kind: 'service',
    subject_ref: 'hadia',
    share_code: CODE,
    criteria_snapshot: criteria,
    pass_rule: { require_all_must: true, blocking_severities: [1, 2], min_score: 0, weights: { must: 3, should: 2, could: 1 } },
    metadata: { template_name: 'Hadia plan' },
    created_at: '2026-11-12T08:00:00Z',
  });
  await page.route(new RegExp(`${q}/sessions(\\?.*)?$`), (r) => json(r, { data: [session()], total: 1, page: 1, limit: 20, hasMore: false }));
  await page.route(new RegExp(`${q}/sessions/${SESSION_ID}$`), (r) => json(r, session()));
  await page.route(new RegExp(`${q}/sessions/${SESSION_ID}/outcome$`), (r) =>
    json(r, {
      accepted: s.accepted,
      score: s.accepted ? 100 : 60,
      counts: { pass: s.accepted ? 2 : 1, fail: s.accepted ? 0 : 1, blocked: 0, not_run: 0 },
      must_total: 1,
      must_passed: 1,
      open_blocking: s.accepted ? 0 : 1,
      reasons: s.accepted ? [] : ['a blocking failure is open'],
      criteria: [
        { id: C1, area_code: 'OWN', title: criteria[0].title, weight: 'must', status: 'pass', testers: 1 },
        { id: C2, area_code: 'REG', title: criteria[1].title, weight: 'should', status: s.accepted ? 'pass' : 'fail', severity: s.accepted ? undefined : 2, testers: 1 },
      ],
    }),
  );
  await page.route(new RegExp(`${q}/sessions/${SESSION_ID}/results(\\?.*)?$`), (r) =>
    json(r, {
      data: [
        { id: 'r1', criterion_id: C1, tester_hint: 'a***@acme.test', result: 'pass', created_at: '2026-11-12T09:00:00Z' },
        { id: 'r2', criterion_id: C2, tester_hint: 'b***@acme.test', result: s.accepted ? 'pass' : 'fail', severity: s.accepted ? undefined : 2, notes: 'List is empty', created_at: '2026-11-12T09:05:00Z' },
      ],
    }),
  );
  await page.route(new RegExp(`${q}/sessions/${SESSION_ID}/defects$`), (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as { criterion_id: string };
      s.raised.push(body.criterion_id);
      return json(r, { id: 'd1', criterion_id: body.criterion_id, severity: 2, status: 'ticketed', ticket_number: 'TCK-42' });
    }
    return json(r, { data: s.accepted ? [] : [{ id: 'd1', criterion_id: C2, severity: 2, status: 'ticket_failed', last_error: 'ticketing unavailable' }] });
  });
  await page.route(new RegExp(`${q}/sessions/${SESSION_ID}/invites(/[^/]+)?$`), (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as { invites: TenantState['invites'] };
      s.invites.push(...body.invites);
      return json(r, { data: [] });
    }
    if (r.request().method() === 'DELETE') return r.fulfill({ status: 204 });
    return json(r, { data: [{ id: 'i1', email_hint: 's***@acme.test', name: 'Signer One', role: 'signer', status: 'invited' }] });
  });
  await page.route(new RegExp(`${q}/sessions/${SESSION_ID}/decision$`), (r) => {
    const body = r.request().postDataJSON() as { decision: string; reason: string };
    s.decisions.push(body);
    s.sessionStatus = body.decision as TenantState['sessionStatus'];
    return json(r, { ...session(), status: body.decision });
  });
  await page.route(new RegExp(`${q}/sessions/${SESSION_ID}/report\\.pdf$`), (r) => r.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }));
  await page.route(new RegExp(`${q}/catalog/features(\\?.*)?$`), (r) => json(r, { data: [], available: false }));
  await page.route(new RegExp(`${q}/templates/${TEMPLATE_ID}$`), (r) =>
    json(r, {
      id: TEMPLATE_ID,
      tenant_id: user.tenant_id,
      name: 'Hadia plan',
      status: 'active',
      version: 3,
      pass_rule: { require_all_must: true, blocking_severities: [1, 2], min_score: 0, weights: { must: 3, should: 2, could: 1 } },
      edges: { criteria: criteria.map((c) => ({ ...c, template_id: TEMPLATE_ID })) },
    }),
  );
  await page.route(new RegExp(`${q}/templates/${TEMPLATE_ID}/criteria$`), (r) => {
    const body = r.request().postDataJSON() as { criteria: unknown[] };
    s.imported += body.criteria.length;
    return json(r, { data: body.criteria }, 201);
  });
}
