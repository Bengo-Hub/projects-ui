import type { Page } from '@playwright/test';
import { ORG, json } from './qa-mocks';
import { ME, MEMBER, PROJECT_ID } from './work-mocks';

// Mocks for the tender screens (sprints 1 and 2): the paged list with search, the go/no-go
// decision, sections and their review, submissions, documents, the outcome and the conversion.
// Add after mockTenantApi: Playwright tries the most recently added route first.

export const TENDER_ID = 'fffffff1-0000-4000-8000-000000000001';
export const SEC_REVIEW = 'fffffff2-0000-4000-8000-000000000001';
export const SEC_MINE = 'fffffff2-0000-4000-8000-000000000002';
export const DOC_ID = 'fffffff3-0000-4000-8000-000000000001';
export const COMMITTEE_ID = 'fffffff4-0000-4000-8000-000000000001';

/** A tender manager who may also convert, use templates and manage budgets. */
export const TENDER_MANAGE = [
  'projects.tenders.view',
  'projects.tenders.add',
  'projects.tenders.change',
  'projects.tenders.delete',
  'projects.tenders.manage',
  'projects.projects.add',
  'projects.projects.view',
  'projects.templates.view',
  'projects.financials.manage',
];

type Row = Record<string, unknown>;

export interface TenderState {
  tender: Row;
  extra: Row[];
  listQueries: string[];
  statusPosts: Row[];
  decisions: Row[];
  outcomes: Row[];
  converts: Row[];
  pushes: number;
  puts: Row[];
  sections: Row[];
  sectionPosts: Row[];
  reviews: { id: string; action: string; body: Row }[];
  submissions: Row[];
  submissionPosts: Row[];
  documents: Row[];
}

const MOVES: Record<string, string[]> = {
  draft: ['evaluating', 'cancelled'],
  evaluating: ['draft', 'cancelled'],
  preparing: ['evaluating', 'cancelled'],
  no_go: ['evaluating'],
  submitted: ['under_review', 'shortlisted', 'cancelled'],
  under_review: ['shortlisted', 'cancelled'],
  shortlisted: ['under_review', 'cancelled'],
  cancelled: ['draft'],
};

function listTender(i: number): Row {
  const n = String(i).padStart(4, '0');
  return {
    id: `fffffff9-0000-4000-8000-00000000${n}`,
    tenant_id: 't',
    number: `TND-2026-${n}`,
    title: i % 5 === 0 ? `Road works lot ${i}` : `Supply of laptops ${i}`,
    client_name: 'County Government',
    status: 'draft',
    priority: 'medium',
    currency: 'KES',
    submission_type: 'online',
    estimated_value: 1000000 + i,
    created_at: '2026-11-10T08:00:00Z',
    updated_at: '2026-11-10T08:00:00Z',
    created_by: ME,
  };
}

export function freshTenders(over: { status?: string; tender?: Row; sections?: Row[] } = {}): TenderState {
  return {
    tender: {
      id: TENDER_ID,
      tenant_id: 't',
      number: 'TND-2026-0100',
      title: 'Hospital ICT network',
      client_name: 'Ministry of Health',
      status: over.status ?? 'evaluating',
      priority: 'high',
      currency: 'KES',
      estimated_value: 5000000,
      submission_type: 'email',
      deadline: '2026-12-15T00:00:00Z',
      created_at: '2026-11-01T08:00:00Z',
      updated_at: '2026-11-01T08:00:00Z',
      created_by: ME,
      metadata: { crm_contact_id: 'c0ffee00-0000-4000-8000-000000000001', crm_contact_name: 'Ministry of Health', bid_budget: { lines: [{ name: 'Switches', category: 'expense', planned_amount: '1200000' }] } },
      ...over.tender,
    },
    extra: Array.from({ length: 25 }, (_, i) => listTender(i + 1)),
    listQueries: [],
    statusPosts: [],
    decisions: [],
    outcomes: [],
    converts: [],
    pushes: 0,
    puts: [],
    sections: over.sections ?? [
      { id: SEC_REVIEW, tender_id: TENDER_ID, title: 'Technical proposal', position: 0, assignee_id: MEMBER, assignee_name: 'Mary Member', reviewer_id: ME, reviewer_name: 'Owner', status: 'in_review', created_at: '2026-11-02T08:00:00Z', updated_at: '2026-11-02T08:00:00Z' },
      { id: SEC_MINE, tender_id: TENDER_ID, title: 'Financial proposal', position: 1, assignee_id: ME, assignee_name: 'Owner', reviewer_id: MEMBER, reviewer_name: 'Mary Member', status: 'in_progress', created_at: '2026-11-02T08:00:00Z', updated_at: '2026-11-02T08:00:00Z' },
    ],
    sectionPosts: [],
    reviews: [],
    submissions: [],
    submissionPosts: [],
    documents: [
      { id: DOC_ID, tender_id: TENDER_ID, file_url: 'projects/t/attachments/tenders/x/a.pdf', file_name: 'Tender notice.pdf', uploaded_by: ME, uploaded_at: '2026-11-01T09:00:00Z', url: 'https://storage.example.test/a.pdf', stored: true },
    ],
  };
}

function summary(sections: Row[]) {
  const by: Record<string, number> = { not_started: 0, in_progress: 0, in_review: 0, changes_requested: 0, approved: 0 };
  for (const s of sections) by[s.status as string]++;
  return { total: sections.length, by_status: by, ready: sections.length > 0 && by.approved === sections.length };
}

export async function mockTendersApi(page: Page, s: TenderState) {
  const b = `/api/v1/${ORG}`;
  const t = `${b}/tenders/${TENDER_ID}`;
  const view = () => ({ ...s.tender, allowed_moves: MOVES[s.tender.status as string] ?? [], can_open_project: true });

  await page.route(new RegExp(`${b}/tenders(\\?.*)?$`), (r) => {
    const url = new URL(r.request().url());
    s.listQueries.push(url.search);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const pageNo = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const all = [s.tender, ...s.extra].filter((x) => !q || String(x.title).toLowerCase().includes(q));
    const rows = all.slice((pageNo - 1) * limit, pageNo * limit);
    return json(r, { data: rows, total: all.length, limit, page: pageNo, hasMore: pageNo * limit < all.length });
  });
  await page.route(new RegExp(`${b}/tenders/metrics$`), (r) =>
    json(r, { total: 26, total_estimated_value: 31000000, win_rate: 50, pipeline_value: 26000000, awarded_value: 0, by_status: { awarded: { count: 1, value: 1 } } }),
  );
  await page.route(new RegExp(`${t}$`), (r) => {
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON() as Row;
      s.puts.push(body);
      const { metadata, ...fields } = body as { metadata?: Row };
      Object.assign(s.tender, fields);
      if (metadata) {
        const meta = { ...(s.tender.metadata as Row) };
        for (const [k, v] of Object.entries(metadata)) {
          if (v === null) delete meta[k];
          else meta[k] = v;
        }
        s.tender.metadata = meta;
      }
      s.tender.updated_at = `2026-11-17T10:00:0${s.puts.length}Z`;
    }
    return json(r, view());
  });
  await page.route(new RegExp(`${t}/status$`), (r) => {
    const body = r.request().postDataJSON() as Row;
    s.statusPosts.push(body);
    s.tender.status = body.status;
    return json(r, view());
  });
  await page.route(new RegExp(`${t}/evaluation-summary$`), (r) =>
    json(r, {
      count: 2,
      average_score: 72,
      min_score: 65,
      max_score: 79,
      evaluators: [],
      default_criteria: [
        { key: 'strategic_fit', label: 'Strategic fit', weight: 20, score: 0 },
        { key: 'technical_capability', label: 'Technical capability', weight: 20, score: 0 },
        { key: 'capacity', label: 'Team capacity and timing', weight: 15, score: 0 },
        { key: 'financial_value', label: 'Value and margin', weight: 20, score: 0 },
        { key: 'win_probability', label: 'Chance of winning', weight: 15, score: 0 },
        { key: 'risk', label: 'Risk (5 is low risk)', weight: 10, score: 0 },
      ],
      criteria_note: 'Scores run from 0 (poor) to 5 (strong); for risk, 5 means low risk.',
      default_threshold: 65,
    }),
  );
  await page.route(new RegExp(`${t}/decision$`), (r) => {
    const body = r.request().postDataJSON() as Row;
    s.decisions.push(body);
    s.tender.status = body.decision === 'go' ? 'preparing' : 'no_go';
    (s.tender.metadata as Row).go_decision = { ...body, weighted_score: 100, recommendation: 'go', threshold: 65, decided_by: ME, decided_at: '2026-11-17T09:00:00Z' };
    return json(r, view());
  });
  await page.route(new RegExp(`${t}/outcome$`), (r) => {
    const body = r.request().postDataJSON() as Row;
    s.outcomes.push(body);
    s.tender.status = body.outcome === 'won' ? 'awarded' : 'lost';
    (s.tender.metadata as Row).outcome = { ...body, recorded_at: '2026-11-17T09:00:00Z' };
    return json(r, view());
  });
  await page.route(new RegExp(`${t}/convert$`), (r) => {
    const body = r.request().postDataJSON() as Row;
    s.converts.push(body);
    const project = { id: PROJECT_ID, name: body.name ?? 'Hospital ICT network', status: 'active', currency: 'KES', owner_id: ME };
    (s.tender.metadata as Row).conversion = { project_id: PROJECT_ID, project_name: project.name, converted_at: '2026-11-17T09:00:00Z', converted_by: ME, members_added: 1, documents_linked: 1, budget: { status: 'created', budget_id: 'tb-1', attempts: 1 } };
    return json(r, { project, tender: view(), already_converted: false, members_added: 1, documents_linked: 1, template: null, budget: { status: 'created' } }, 201);
  });
  await page.route(new RegExp(`${t}/conversion/push-budget$`), (r) => {
    s.pushes++;
    const conv = (s.tender.metadata as Row).conversion as Row;
    conv.budget = { status: 'created', budget_id: 'tb-1', attempts: 2 };
    return json(r, { budget: conv.budget });
  });

  await page.route(new RegExp(`${t}/sections$`), (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as Row;
      s.sectionPosts.push(body);
      const row = { id: `fffffff2-0000-4000-8000-00000000000${s.sections.length + 1}`, tender_id: TENDER_ID, position: s.sections.length, status: 'not_started', assignee_name: '', reviewer_name: '', created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z', ...body };
      s.sections.push(row);
      return json(r, row, 201);
    }
    return json(r, { data: s.sections, summary: summary(s.sections) });
  });
  await page.route(new RegExp(`${t}/sections/[^/]+/(submit|approve|request-changes)$`), (r) => {
    const parts = r.request().url().split('/');
    const action = parts.pop()!;
    const id = parts.pop()!;
    const body = (r.request().postDataJSON() ?? {}) as Row;
    s.reviews.push({ id, action, body });
    const row = s.sections.find((x) => x.id === id)!;
    row.status = action === 'submit' ? 'in_review' : action === 'approve' ? 'approved' : 'changes_requested';
    if (action === 'request-changes') row.review_comment = body.comment;
    return json(r, row);
  });

  await page.route(new RegExp(`${t}/submissions$`), (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as Row;
      s.submissionPosts.push(body);
      const row = { id: `sub-${s.submissions.length + 1}`, tender_id: TENDER_ID, submitted_at: '2026-11-17T08:00:00Z', submitted_by: ME, submitted_by_name: 'Owner', metadata: { resubmission: s.submissions.length > 0 }, created_at: '2026-11-17T08:00:00Z', ...body };
      s.submissions.unshift(row);
      if (s.tender.status === 'preparing') s.tender.status = 'submitted';
      return json(r, row, 201);
    }
    return json(r, { data: s.submissions });
  });
  await page.route(new RegExp(`${t}/documents$`), (r) => json(r, { data: s.documents }));
  await page.route(new RegExp(`${t}/committees$`), (r) =>
    json(r, {
      data: [
        { id: COMMITTEE_ID, tender_id: TENDER_ID, tenant_id: 't', name: 'Bid panel', created_at: '2026-11-01T08:00:00Z', edges: { members: [{ id: 'm1', committee_id: COMMITTEE_ID, user_id: MEMBER, role: 'chair', joined_at: '2026-11-01T08:00:00Z', user_name: 'Mary Member', email: 'mary@acme.test' }] } },
      ],
    }),
  );
  await page.route(new RegExp(`${b}/people(\\?.*)?$`), (r) =>
    json(r, { data: [{ user_id: MEMBER, name: 'Mary Member', email: 'mary@acme.test' }], total: 1, limit: 20, page: 1, hasMore: false }),
  );
}
