import type { Page } from '@playwright/test';
import { ORG, json } from './qa-mocks';
import { ME, MEMBER, PROJECT_ID } from './work-mocks';

// Mocks for the sprint 7 screens: status reports, the weekly digest switch, governance (seats,
// RACI, decision log) and the client portal's shared reports. Add after mockTenantApi and
// mockWorkApi (or mockPortalApi): Playwright tries the most recently added route first.

export const PDF = '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF';

/** A project manager's sprint 7 codes with the portal and financial ones that sharing reads. */
export const REPORTS_MANAGE = [
  'projects.reports.manage',
  'projects.governance.manage',
  'projects.portal.manage',
  'projects.financials.view',
  'projects.members.manage',
];

/** The member and viewer roles' sprint 7 codes. */
export const REPORTS_VIEW = ['projects.reports.view', 'projects.governance.view'];

export const R_DRAFT = 'f0000001-0000-4000-8000-000000000001';
export const R_PUB = 'f0000002-0000-4000-8000-000000000002';
export const R_NEW = 'f0000003-0000-4000-8000-000000000003';
export const RISK_ID = 'ccccccc1-0000-4000-8000-000000000001';
export const SEAT_TEAM = 'f1000001-0000-4000-8000-000000000001';
export const SEAT_OUT = 'f1000002-0000-4000-8000-000000000002';
export const RACI_1 = 'f2000001-0000-4000-8000-000000000001';
export const D_APPROVED = 'f3000001-0000-4000-8000-000000000001';
export const D_PROPOSED = 'f3000002-0000-4000-8000-000000000002';

type Row = Record<string, unknown>;

const kpis = {
  tasks_total: 12,
  tasks_done: 5,
  tasks_overdue: 1,
  tasks_completed_in_period: 2,
  percent_complete: 41.6,
  percent_planned: 46.2,
  schedule_index: 0.9,
  milestones_total: 3,
  milestones_done: 1,
  milestones_overdue: 0,
  open_risks: 2,
  high_risks: 1,
  pending_change_requests: 1,
  pending_scope_changes: 0,
};

const financials = {
  currency: 'KES',
  bac: 1200000,
  ac: 520000,
  ev: 500000,
  pv: 560000,
  eac: 1248000,
  etc: 728000,
  vac: -48000,
  cpi: 0.96,
  spi: 0.89,
  percent_spent: 43.3,
  committed: 150000,
  revenue: 1500000,
  margin: 252000,
  margin_pct: 16.8,
  health: 'amber',
  health_reason: 'cost index 0.96, slightly over budget',
};

function draft(over: Row = {}): Row {
  return {
    id: R_DRAFT,
    project_id: PROJECT_ID,
    title: 'Week 45 report',
    period_start: '2026-11-02T00:00:00Z',
    period_end: '2026-11-08T00:00:00Z',
    status: 'draft',
    rag_overall: 'amber',
    rag_schedule: 'amber',
    rag_cost: 'amber',
    rag_scope: 'green',
    narrative: '<p>Foundations are done; steel is the worry.</p>',
    highlights: ['Pour foundation slab finished'],
    risks: [{ risk_id: RISK_ID, title: 'Steel delivery runs late', likelihood: 4, impact: 4, score: 16, status: 'open', owner_name: 'Mary Member', mitigation: 'Second supplier on standby' }],
    milestones: [{ milestone_id: 'm1', name: 'Shell complete', target_date: '2026-11-20T00:00:00Z', status: 'pending', overdue: false }],
    kpis,
    financials,
    suggested: { overall: 'amber', schedule: 'amber', cost: 'amber', scope: 'green', reasons: { schedule: 'schedule index 0.90, behind plan', cost: 'cost index 0.96, slightly over budget', scope: 'no scope change waiting' } },
    filled_at: '2026-11-09T07:00:00Z',
    client_visible: false,
    include_financials: false,
    created_by: ME,
    created_by_name: 'Owner',
    published_by_name: '',
    shared_by_name: '',
    financials_hidden: false,
    created_at: '2026-11-09T07:00:00Z',
    updated_at: '2026-11-09T07:00:00Z',
    ...over,
  };
}

function published(over: Row = {}): Row {
  return draft({
    id: R_PUB,
    title: 'Week 44 report',
    period_start: '2026-10-26T00:00:00Z',
    period_end: '2026-11-01T00:00:00Z',
    status: 'published',
    rag_overall: 'green',
    rag_schedule: 'green',
    rag_cost: 'green',
    published_at: '2026-11-02T09:00:00Z',
    published_by: ME,
    published_by_name: 'Owner',
    ...over,
  });
}

export interface ReportsState {
  reports: Row[];
  /** Readers without financial access: financials null and financials_hidden true. */
  hideFinancials: boolean;
  posts: Row[];
  puts: { id: string; body: Row }[];
  refreshes: string[];
  publishes: string[];
  deletes: string[];
  shares: { id: string; body: Row }[];
  unshares: string[];
  pdfCalls: number;
  digest: { weekly_enabled: boolean };
  digestPuts: Row[];
}

export function freshReports(over: Partial<ReportsState> = {}): ReportsState {
  return {
    reports: [draft(), published()],
    hideFinancials: false,
    posts: [],
    puts: [],
    refreshes: [],
    publishes: [],
    deletes: [],
    shares: [],
    unshares: [],
    pdfCalls: 0,
    digest: { weekly_enabled: true },
    digestPuts: [],
    ...over,
  };
}

/** A draft with no overall rating yet, for the publish refusal. */
export function unratedDraft(): Row {
  return draft({ rag_overall: '' });
}

let stamp = 0;
const touched = () => new Date(Date.UTC(2026, 10, 17, 9, 0, ++stamp)).toISOString();

export async function mockReportsApi(page: Page, s: ReportsState, opts: { adminTier?: boolean } = {}) {
  const t = `/api/v1/${ORG}`;
  const p = `${t}/projects/${PROJECT_ID}/status-reports`;
  const view = (r: Row) => (s.hideFinancials && r.financials ? { ...r, financials: null, financials_hidden: true } : r);
  const find = (id: string) => s.reports.find((r) => r.id === id);

  await page.route(new RegExp(`${p}(\\?.*)?$`), (r) => {
    if (r.request().method() === 'POST') {
      const body = (r.request().postDataJSON() ?? {}) as Row;
      s.posts.push(body);
      const start = String(body.period_start ?? '');
      if (s.reports.some((x) => String(x.period_start).slice(0, 10) === start)) {
        return json(r, { error: 'a report for this period already exists', code: 'report_exists' }, 409);
      }
      const row = draft({
        id: R_NEW,
        title: body.title || `Status report ${start} to ${body.period_end}`,
        period_start: `${start}T00:00:00Z`,
        period_end: `${body.period_end}T00:00:00Z`,
        created_at: touched(),
        updated_at: touched(),
      });
      s.reports.unshift(row);
      return json(r, view(row), 201);
    }
    const rows = [...s.reports].sort((a, b) => String(b.period_start).localeCompare(String(a.period_start))).map(view);
    return json(r, { data: rows, total: rows.length, limit: 20, page: 1, hasMore: false });
  });

  await page.route(new RegExp(`${p}/[^/?]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    const row = find(id);
    if (!row) return json(r, { error: 'not found', code: 'not_found' }, 404);
    if (r.request().method() === 'DELETE') {
      s.deletes.push(id);
      s.reports = s.reports.filter((x) => x.id !== id);
      return r.fulfill({ status: 204, body: '' });
    }
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON() as Row;
      s.puts.push({ id, body });
      if (row.status !== 'draft') return json(r, { error: 'the report is published', code: 'report_published' }, 409);
      Object.assign(row, body, { updated_at: touched() });
    }
    return json(r, view(row));
  });

  await page.route(new RegExp(`${p}/[^/]+/(refresh|publish|share|unshare)$`), (r) => {
    const parts = r.request().url().split('/');
    const action = parts.pop()!;
    const id = parts.pop()!;
    const row = find(id)!;
    const body = (r.request().postDataJSON() ?? {}) as Row;
    if (action === 'refresh') {
      s.refreshes.push(id);
      row.updated_at = touched();
    } else if (action === 'publish') {
      s.publishes.push(id);
      if (!row.rag_overall) return json(r, { error: 'set the overall rating before publishing', code: 'validation_error' }, 422);
      Object.assign(row, { status: 'published', published_at: '2026-11-17T09:00:00Z', published_by: ME, published_by_name: 'Owner', updated_at: touched() });
    } else if (action === 'share') {
      s.shares.push({ id, body });
      if (row.status !== 'published') return json(r, { error: 'publish the report first', code: 'report_not_published' }, 409);
      Object.assign(row, { client_visible: true, include_financials: body.include_financials === true, shared_at: '2026-11-17T10:00:00Z', shared_by: ME, shared_by_name: 'Owner', updated_at: touched() });
    } else {
      s.unshares.push(id);
      Object.assign(row, { client_visible: false, updated_at: touched() });
    }
    return json(r, view(row));
  });

  await page.route(new RegExp(`${p}/[^/]+/pdf$`), (r) => {
    s.pdfCalls++;
    return r.fulfill({ status: 200, contentType: 'application/pdf', body: PDF });
  });

  await page.route(new RegExp(`${t}/settings/digest$`), (r) => {
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON() as Row;
      s.digestPuts.push(body);
      if (!opts.adminTier) return json(r, { error: 'only an administrator can do this', code: 'admin_required' }, 403);
      s.digest = { weekly_enabled: body.weekly_enabled === true };
    }
    return json(r, s.digest);
  });
}

// Governance.

export interface GovernanceState {
  roles: Row[];
  rolePosts: Row[];
  rolePuts: { id: string; body: Row }[];
  roleDeletes: string[];
  raci: Row[];
  raciPosts: Row[];
  raciDeletes: string[];
  decisions: Row[];
  decisionPosts: Row[];
  decides: { id: string; body: Row }[];
  supersedes: { id: string; body: Row }[];
  decisionDeletes: string[];
}

export function freshGovernance(over: Partial<GovernanceState> = {}): GovernanceState {
  const people = { [ME]: 'Owner', [MEMBER]: 'Mary Member' };
  return {
    roles: [
      { id: SEAT_TEAM, project_id: PROJECT_ID, role: 'sponsor', title: '', user_id: MEMBER, user_name: 'Mary Member', person_name: '', organisation: '', responsibilities: '<p>Signs off the budget.</p>', created_at: '2026-11-10T08:00:00Z' },
      { id: SEAT_OUT, project_id: PROJECT_ID, role: 'project_board', title: 'Chair', user_id: null, user_name: '', person_name: 'Jane Board', organisation: 'Riverside Health', responsibilities: '', created_at: '2026-11-10T08:00:00Z' },
    ],
    rolePosts: [],
    rolePuts: [],
    roleDeletes: [],
    raci: [
      { id: RACI_1, project_id: PROJECT_ID, activity: 'Approve the design', task_id: null, task_title: '', accountable_id: ME, responsible_ids: [MEMBER], consulted_ids: [], informed_ids: [], position: 0, people },
    ],
    raciPosts: [],
    raciDeletes: [],
    decisions: [
      { id: D_PROPOSED, project_id: PROJECT_ID, number: 2, title: 'Switch to precast slabs', context: '<p>The plant is closed.</p>', decision: '', rationale: '', impact: 'schedule', status: 'proposed', proposed_by: MEMBER, approver_ids: [ME, MEMBER], approvals: [], people, created_at: '2026-11-16T08:00:00Z' },
      { id: D_APPROVED, project_id: PROJECT_ID, number: 1, title: 'Use the north gate for deliveries', context: '', decision: '', rationale: '', impact: '', status: 'approved', proposed_by: ME, approver_ids: [], approvals: [], decided_at: '2026-11-05T08:00:00Z', people, created_at: '2026-11-05T08:00:00Z' },
    ],
    decisionPosts: [],
    decides: [],
    supersedes: [],
    decisionDeletes: [],
    ...over,
  };
}

export async function mockGovernanceApi(page: Page, s: GovernanceState) {
  const p = `/api/v1/${ORG}/projects/${PROJECT_ID}`;
  const page1 = (rows: Row[]) => ({ data: rows, total: rows.length, limit: 20, page: 1, hasMore: false });

  await page.route(new RegExp(`${p}/governance/roles$`), (r) => {
    if (r.request().method() !== 'POST') return json(r, { data: s.roles });
    const body = r.request().postDataJSON() as Row;
    s.rolePosts.push(body);
    const row = { id: `f100000${s.roles.length + 1}-0000-4000-8000-000000000009`, project_id: PROJECT_ID, title: '', user_id: null, user_name: '', person_name: '', organisation: '', responsibilities: '', created_at: '2026-11-17T08:00:00Z', ...body };
    s.roles.push(row);
    return json(r, row, 201);
  });
  await page.route(new RegExp(`${p}/governance/roles/[^/]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    if (r.request().method() === 'DELETE') {
      s.roleDeletes.push(id);
      s.roles = s.roles.filter((x) => x.id !== id);
      return r.fulfill({ status: 204, body: '' });
    }
    const body = r.request().postDataJSON() as Row;
    s.rolePuts.push({ id, body });
    const row = s.roles.find((x) => x.id === id)!;
    Object.assign(row, body);
    return json(r, row);
  });

  await page.route(new RegExp(`${p}/raci$`), (r) => {
    if (r.request().method() !== 'POST') return json(r, { data: s.raci });
    const body = r.request().postDataJSON() as Row;
    s.raciPosts.push(body);
    const row = { id: `f200000${s.raci.length + 1}-0000-4000-8000-000000000009`, project_id: PROJECT_ID, task_id: null, task_title: '', position: s.raci.length, people: { [ME]: 'Owner', [MEMBER]: 'Mary Member' }, ...body };
    s.raci.push(row);
    return json(r, row, 201);
  });
  await page.route(new RegExp(`${p}/raci/[^/]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    if (r.request().method() === 'DELETE') {
      s.raciDeletes.push(id);
      s.raci = s.raci.filter((x) => x.id !== id);
      return r.fulfill({ status: 204, body: '' });
    }
    const row = s.raci.find((x) => x.id === id)!;
    Object.assign(row, r.request().postDataJSON() as Row);
    return json(r, row);
  });

  await page.route(new RegExp(`${p}/decisions(\\?.*)?$`), (r) => {
    if (r.request().method() !== 'POST') {
      const st = new URL(r.request().url()).searchParams.get('status');
      return json(r, page1(st ? s.decisions.filter((d) => d.status === st) : s.decisions));
    }
    const body = r.request().postDataJSON() as Row;
    s.decisionPosts.push(body);
    const approvers = (body.approver_ids as string[] | undefined) ?? [];
    const row = {
      id: `f300000${s.decisions.length + 1}-0000-4000-8000-000000000009`,
      project_id: PROJECT_ID,
      number: s.decisions.length + 1,
      context: '',
      decision: '',
      rationale: '',
      impact: '',
      ...body,
      status: approvers.length ? 'proposed' : 'approved',
      proposed_by: ME,
      approver_ids: approvers,
      approvals: [],
      people: { [ME]: 'Owner', [MEMBER]: 'Mary Member' },
      created_at: '2026-11-17T08:00:00Z',
    };
    s.decisions.unshift(row);
    return json(r, row, 201);
  });
  await page.route(new RegExp(`${p}/decisions/[^/?]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    if (r.request().method() === 'DELETE') {
      s.decisionDeletes.push(id);
      s.decisions = s.decisions.filter((x) => x.id !== id);
      return r.fulfill({ status: 204, body: '' });
    }
    const row = s.decisions.find((x) => x.id === id)!;
    if (r.request().method() === 'PUT') Object.assign(row, r.request().postDataJSON() as Row);
    return json(r, row);
  });
  await page.route(new RegExp(`${p}/decisions/[^/]+/(decide|supersede)$`), (r) => {
    const parts = r.request().url().split('/');
    const action = parts.pop()!;
    const id = parts.pop()!;
    const row = s.decisions.find((x) => x.id === id)!;
    const body = (r.request().postDataJSON() ?? {}) as Row;
    if (action === 'decide') {
      s.decides.push({ id, body });
      const approvals = [...((row.approvals as Row[]) ?? []), { user_id: ME, decision: body.decision, comment: body.comment, at: '2026-11-17T09:00:00Z' }];
      Object.assign(row, { approvals, ...(body.decision === 'reject' ? { status: 'rejected', decided_at: '2026-11-17T09:00:00Z' } : {}) });
    } else {
      s.supersedes.push({ id, body });
      Object.assign(row, { status: 'superseded', superseded_by: body.superseded_by ?? null });
    }
    return json(r, row);
  });
}

// The client portal's shared reports (add after mockPortalApi).

export const PR_PLAIN = 'f4000001-0000-4000-8000-000000000001';
export const PR_MONEY = 'f4000002-0000-4000-8000-000000000002';

export interface PortalReportsState {
  pdfCalls: number;
}

function portalReport(over: Row = {}): Row {
  return {
    id: PR_PLAIN,
    project_id: PROJECT_ID,
    project_name: 'Riverside clinic fit-out',
    title: 'Week 45 report',
    period_start: '2026-11-02',
    period_end: '2026-11-08',
    rag_overall: 'amber',
    rag_schedule: 'amber',
    rag_cost: '',
    rag_scope: 'green',
    narrative: '<p>Foundations are done; steel is the worry.</p><script>alert(1)</script>',
    highlights: ['Pour foundation slab finished'],
    risks: [{ title: 'Steel delivery runs late', likelihood: 4, impact: 4, score: 16, status: 'open', owner_name: 'Mary Member' }],
    milestones: [{ milestone_id: 'm1', name: 'Shell complete', target_date: '2026-11-20T00:00:00Z', status: 'pending', overdue: false }],
    kpis,
    published_at: '2026-11-09T09:00:00Z',
    shared_at: '2026-11-09T10:00:00Z',
    ...over,
  };
}

export async function mockPortalReportsApi(page: Page, s: PortalReportsState) {
  const p = `/api/v1/${ORG}/portal/projects/${PROJECT_ID}/status-reports`;
  const rows = [
    portalReport(),
    portalReport({ id: PR_MONEY, title: 'Week 44 report', period_start: '2026-10-26', period_end: '2026-11-01', rag_overall: 'green', rag_cost: 'amber', financials }),
  ];
  await page.route(new RegExp(`${p}(\\?.*)?$`), (r) => json(r, { data: rows, total: rows.length, limit: 20, page: 1, hasMore: false }));
  await page.route(new RegExp(`${p}/[^/?]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    const row = rows.find((x) => x.id === id);
    return row ? json(r, row) : json(r, { error: 'not found', code: 'not_found' }, 404);
  });
  await page.route(new RegExp(`${p}/[^/]+/pdf$`), (r) => {
    s.pdfCalls++;
    return r.fulfill({ status: 200, contentType: 'application/pdf', body: PDF });
  });
}
