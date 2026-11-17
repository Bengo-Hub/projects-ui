import type { Page } from '@playwright/test';
import { ORG, STAFF_FEATURES, json } from './qa-mocks';
import { ME, MEMBER, PROJECT_ID, T1, T2, T3, type WorkState } from './work-mocks';

// Mocks for the sprint 16 planning screens: workload, baselines and slips, risks, change requests
// and approvals, templates, recurring tasks, status rules and automations. Add after
// mockTenantApi and mockWorkApi: Playwright tries the most recently added route first.

export const PLANNING_FEATURES = [...STAFF_FEATURES, 'workload_planning', 'project_automation'];

/** A project manager's sprint 16 codes plus the admin-only ones, so every write button shows. */
export const PLANNING_MANAGE = [
  'projects.projects.add',
  'projects.workload.view',
  'projects.workload.manage',
  'projects.baselines.view',
  'projects.baselines.add',
  'projects.baselines.delete',
  'projects.risks.view',
  'projects.risks.add',
  'projects.risks.change',
  'projects.risks.delete',
  'projects.change_requests.manage',
  'projects.change_approvals.manage',
  'projects.templates.view',
  'projects.templates.add',
  'projects.templates.delete',
  'projects.automation.manage',
];

/** The viewer role's sprint 16 codes (roles.go). */
export const PLANNING_VIEW = ['projects.baselines.view', 'projects.risks.view', 'projects.change_requests.view'];

export const BASELINE_ID = 'bbbbbbb1-0000-4000-8000-000000000001';
export const R1 = 'ccccccc1-0000-4000-8000-000000000001';
export const R2 = 'ccccccc2-0000-4000-8000-000000000002';
export const CR_PENDING = 'ddddddd1-0000-4000-8000-000000000001';
export const CR_MINE = 'ddddddd2-0000-4000-8000-000000000002';
export const CR_FAILED = 'ddddddd3-0000-4000-8000-000000000003';
export const TPL_SYSTEM = 'eeeeeee1-0000-4000-8000-000000000001';
export const TPL_OWN = 'eeeeeee2-0000-4000-8000-000000000002';

type Row = Record<string, unknown>;

export interface MoveCheck {
  status: string;
  allowed: boolean;
  reason?: string;
  missing_fields: string[];
  message?: string;
}

export interface PlanningState {
  workloadCalls: number;
  settingsPuts: Row[];
  taskPuts: { taskId: string; body: Row }[];
  /** The next task PUT with metadata.repeat answers 422. */
  refuseRepeat: boolean;
  baselines: Row[];
  baselinePosts: Row[];
  baselineDeletes: string[];
  baselineCalls: number;
  slipsCalls: number;
  risks: Row[];
  riskPosts: Row[];
  riskPuts: { id: string; body: Row }[];
  riskDeletes: string[];
  changes: Row[];
  changePosts: Row[];
  approves: { id: string; body: Row }[];
  rejects: { id: string; body: Row }[];
  withdraws: string[];
  pushes: string[];
  /** The next approval answers 409 change_request_not_pending. */
  notPending: boolean;
  templateStarts: { id: string; body: Row }[];
  templateSaves: Row[];
  templateDeletes: string[];
  rules: { transitions: { from: string; to: string[] }[]; requirements: { to: string; from?: string; fields: string[] }[] };
  rulesPuts: Row[];
  rulesCalls: number;
  automations: Row[];
  automationPuts: Row[];
  moves: Record<string, MoveCheck[]>;
  /** The next status PATCH answers 422 status_rule_blocked. */
  rejectStatus: boolean;
  statusPatches: { taskId: string; status: string }[];
}

const OTHER_STATUSES = ['todo', 'in_progress', 'review', 'done'];

export function freshPlanning(over: Partial<PlanningState> = {}): PlanningState {
  return {
    workloadCalls: 0,
    settingsPuts: [],
    taskPuts: [],
    refuseRepeat: false,
    baselines: [
      { id: BASELINE_ID, project_id: PROJECT_ID, name: 'Signed-off plan', note: 'As agreed with the client', task_count: 3, created_by: ME, created_by_name: 'Owner', created_at: '2026-11-03T08:00:00Z' },
    ],
    baselinePosts: [],
    baselineDeletes: [],
    baselineCalls: 0,
    slipsCalls: 0,
    risks: [
      { id: R1, project_id: PROJECT_ID, title: 'Steel delivery runs late', category: 'Supply', likelihood: 4, impact: 4, score: 16, owner_id: MEMBER, owner_name: 'Mary Member', mitigation: 'Second supplier on standby', status: 'open', due_date: '2026-12-01T00:00:00Z', created_at: '2026-11-05T08:00:00Z', updated_at: '2026-11-05T08:00:00Z' },
      { id: R2, project_id: PROJECT_ID, title: 'Rain delays the slab', likelihood: 2, impact: 3, score: 6, owner_name: '', status: 'monitoring', created_at: '2026-11-06T08:00:00Z', updated_at: '2026-11-06T08:00:00Z' },
    ],
    riskPosts: [],
    riskPuts: [],
    riskDeletes: [],
    changes: [
      {
        id: CR_PENDING,
        project_id: PROJECT_ID,
        title: 'Move the slab a week',
        description: 'The concrete plant is closed for maintenance.',
        kind: 'schedule',
        status: 'pending',
        requested_by: MEMBER,
        requested_by_name: 'Mary Member',
        decided_by_name: '',
        metadata: { date_shifts: [{ task_id: T3, shift_days: 7 }], treasury: { status: 'not_needed' } },
        created_at: '2026-11-15T08:00:00Z',
        updated_at: '2026-11-15T08:00:00Z',
      },
      {
        id: CR_MINE,
        project_id: PROJECT_ID,
        title: 'Add a reception desk',
        kind: 'scope',
        status: 'pending',
        requested_by: ME,
        requested_by_name: 'Owner',
        decided_by_name: '',
        metadata: { treasury: { status: 'not_needed' } },
        created_at: '2026-11-14T08:00:00Z',
        updated_at: '2026-11-14T08:00:00Z',
      },
      {
        id: CR_FAILED,
        project_id: PROJECT_ID,
        title: 'Extra steel budget',
        kind: 'cost',
        status: 'approved',
        requested_by: MEMBER,
        requested_by_name: 'Mary Member',
        decided_by: ME,
        decided_by_name: 'Owner',
        decided_at: '2026-11-12T08:00:00Z',
        decision_comment: 'Agreed on site',
        metadata: {
          budget: { name: 'Steel top-up', fiscal_year: '2026', period_type: 'monthly', start_date: '2026-11-01', end_date: '2026-12-31', currency: 'KES', lines: [{ category: 'expense', name: 'Steel', planned_amount: '250000.00' }] },
          treasury: { status: 'failed', error: 'treasury: budget period overlaps a closed period', attempts: 1, attempted_at: '2026-11-12T08:00:00Z' },
        },
        created_at: '2026-11-10T08:00:00Z',
        updated_at: '2026-11-12T08:00:00Z',
      },
    ],
    changePosts: [],
    approves: [],
    rejects: [],
    withdraws: [],
    pushes: [],
    notPending: false,
    templateStarts: [],
    templateSaves: [],
    templateDeletes: [],
    rules: { transitions: [], requirements: [] },
    rulesPuts: [],
    rulesCalls: 0,
    automations: [],
    automationPuts: [],
    moves: {},
    rejectStatus: false,
    statusPatches: [],
    ...over,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
function addDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function workload(from: string, weeks: number) {
  const list = Array.from({ length: weeks }, (_, i) => addDays(from, i * 7));
  const cell = (week: string, demand: number, capacity: number, tasks: number) => {
    const pct = capacity > 0 ? (demand / capacity) * 100 : 0;
    return { week_start: week, demand_hours: demand, capacity_hours: capacity, load_pct: pct, overloaded: pct > 100 || (capacity === 0 && demand > 0), task_count: tasks };
  };
  return {
    from,
    to: addDays(from, weeks * 7 - 1),
    weeks: list,
    default_weekly_hours: 40,
    capacity_source: 'settings',
    people: [
      { user_id: MEMBER, name: 'Mary Member', email: 'mary@acme.test', weekly_capacity: 40, total_demand: 68, overloaded_weeks: 1, weeks: [cell(list[0], 48, 40, 2), cell(list[1], 20, 40, 1)] },
      { user_id: ME, name: 'Owner', email: 'owner@acme.test', weekly_capacity: 40, total_demand: 10, overloaded_weeks: 0, weeks: [cell(list[0], 10, 40, 1)] },
    ],
    unassigned: [{ week_start: list[0], demand_hours: 6, task_count: 1 }],
    truncated: false,
  };
}

export async function mockPlanningApi(page: Page, s: PlanningState, work?: WorkState) {
  const t = `/api/v1/${ORG}`;
  const p = `${t}/projects/${PROJECT_ID}`;

  // The project list (approvals names the project; templates route to the new one).
  await page.route(new RegExp(`${t}/projects(\\?.*)?$`), (r) =>
    json(r, { data: [{ id: PROJECT_ID, name: 'Riverside clinic fit-out', status: 'active', currency: 'KES', owner_id: ME, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-10T08:00:00Z' }], total: 1, limit: 100, page: 1, hasMore: false }),
  );

  // Workload.
  await page.route(new RegExp(`${t}/workload(\\?.*)?$`), (r) => {
    s.workloadCalls++;
    const url = new URL(r.request().url());
    const from = url.searchParams.get('from') ?? '2026-11-16';
    return json(r, workload(from, Number(url.searchParams.get('weeks') ?? 8)));
  });
  await page.route(new RegExp(`${t}/workload/tasks(\\?.*)?$`), (r) => {
    const user = new URL(r.request().url()).searchParams.get('user_id');
    if (user !== MEMBER) return json(r, { data: [] });
    return json(r, {
      data: [
        { task_id: T2, title: 'Order roof trusses', project_id: PROJECT_ID, project_name: 'Riverside clinic fit-out', status: 'in_progress', due_date: '2026-11-20', hours: 30 },
        { task_id: T1, title: 'Pour foundation slab', project_id: PROJECT_ID, project_name: 'Riverside clinic fit-out', status: 'todo', due_date: '2026-11-19', hours: 18 },
      ],
    });
  });
  await page.route(new RegExp(`${t}/workload/settings$`), (r) => {
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON() as Row;
      s.settingsPuts.push(body);
      return json(r, { ...body, capacity_source: 'settings' });
    }
    return json(r, { weekly_hours: 40, person_hours: {}, capacity_source: 'settings' });
  });

  // Task updates (reassign, repeat): applied to the work mock's tasks; reads fall through.
  await page.route(new RegExp(`${p}/tasks/[^/]+$`), (r) => {
    if (r.request().method() !== 'PUT') return r.fallback();
    const id = r.request().url().split('/').pop()!;
    const body = r.request().postDataJSON() as Row;
    s.taskPuts.push({ taskId: id, body });
    const meta = body.metadata as Row | undefined;
    if (meta && 'repeat' in meta && s.refuseRepeat) {
      s.refuseRepeat = false;
      return json(r, { error: 'repeat.interval must be between 1 and 365', code: 'validation_error' }, 422);
    }
    const task = work?.tasks.find((x) => x.id === id) as Row | undefined;
    if (task) {
      if (Array.isArray(body.assignee_ids)) (task as { edges: Row }).edges = { ...(task.edges as Row), assignees: (body.assignee_ids as string[]).map((u, i) => ({ user_id: u, is_primary: i === 0 })) };
      if (meta) task.metadata = meta;
    }
    return json(r, task ?? { id });
  });

  // Status moves: the rules' answer per task, and a 422 when asked.
  await page.route(new RegExp(`${p}/task-moves/[^/]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    const checks = s.moves[id] ?? OTHER_STATUSES.map((k) => ({ status: k, allowed: true, missing_fields: [] }));
    return json(r, { data: checks });
  });
  await page.route(new RegExp(`${p}/tasks/[^/]+/status$`), (r) => {
    const id = r.request().url().split('/').slice(-2)[0];
    const body = r.request().postDataJSON() as { status: string };
    s.statusPatches.push({ taskId: id, status: body.status });
    if (s.rejectStatus) {
      s.rejectStatus = false;
      return json(r, { error: 'Before moving to Done, this task needs actual hours.', code: 'status_rule_blocked', from: 'todo', to: body.status, reason: 'missing_fields', missing_fields: ['actual_hours'] }, 422);
    }
    return r.fallback();
  });

  // Baselines and slips.
  await page.route(new RegExp(`${p}/baselines$`), (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as Row;
      s.baselinePosts.push(body);
      const row = { id: `bbbbbbb${s.baselines.length + 1}-0000-4000-8000-000000000009`, project_id: PROJECT_ID, name: body.name ?? 'Baseline 2026-11-17 09:00', note: body.note ?? '', task_count: 4, created_by: ME, created_by_name: 'Owner', created_at: '2026-11-17T09:00:00Z' };
      s.baselines.unshift(row);
      return json(r, row, 201);
    }
    s.baselineCalls++;
    return json(r, { data: s.baselines });
  });
  await page.route(new RegExp(`${p}/baselines/[^/]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    if (r.request().method() === 'DELETE') {
      s.baselineDeletes.push(id);
      s.baselines = s.baselines.filter((b) => b.id !== id);
      return r.fulfill({ status: 204, body: '' });
    }
    return json(r, s.baselines.find((b) => b.id === id) ?? {}, s.baselines.some((b) => b.id === id) ? 200 : 404);
  });
  await page.route(new RegExp(`${p}/slips(\\?.*)?$`), (r) => {
    s.slipsCalls++;
    if (s.baselines.length === 0) return json(r, { error: 'not found', code: 'not_found' }, 404);
    return json(r, {
      baseline: s.baselines[0],
      slips: [
        { kind: 'task', id: T1, title: 'Pour foundation slab', status: 'todo', baseline_start: '2026-11-02', current_start: '2026-11-02', baseline_finish: '2026-11-05', current_finish: '2026-11-06', start_slip_days: 0, finish_slip_days: 1, estimate_change_hours: 0 },
        { kind: 'task', id: T3, title: 'Cure slab', status: 'todo', baseline_start: '2026-11-05', current_start: '2026-11-09', baseline_finish: '2026-11-08', current_finish: '2026-11-12', start_slip_days: 4, finish_slip_days: 4, estimate_change_hours: 6 },
        { kind: 'milestone', id: 'm1', title: 'Shell complete', baseline_finish: '2026-11-20', current_finish: '2026-11-27', start_slip_days: 0, finish_slip_days: 7, estimate_change_hours: 0 },
      ],
      tasks_compared: 3,
      slipped: 2,
      pulled_in: 0,
      max_slip_days: 4,
      removed_since: 0,
      added_since: 1,
      milestones_slipped: 1,
    });
  });
  await page.route(new RegExp(`${p}/gantt(\\?.*)?$`), (r) => {
    const rows = (work?.tasks ?? [])
      .filter((x) => x.start_date)
      .map((x) => ({ ...x, critical: x.id !== T3, edges: { ...x.edges, dependencies: [] } }));
    const baseline =
      s.baselines.length > 0
        ? { id: s.baselines[0].id, name: s.baselines[0].name, created_at: s.baselines[0].created_at, tasks: { [T3]: { id: T3, title: 'Cure slab', status: 'todo', start_date: '2026-11-05T00:00:00Z', due_date: '2026-11-08T00:00:00Z' } }, milestones: [], truncated: false }
        : null;
    return json(r, { data: rows, truncated: false, limit: 2000, critical_days: 11, baseline });
  });

  // Risks.
  const heat = (all: boolean) => {
    const grid = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
    for (const x of s.risks) {
      if (!all && (x.status === 'closed' || x.status === 'occurred')) continue;
      grid[(x.likelihood as number) - 1][(x.impact as number) - 1]++;
    }
    return { grid, cells: [], total: s.risks.length };
  };
  await page.route(new RegExp(`${p}/risks(\\?.*)?$`), (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as Row;
      s.riskPosts.push(body);
      const row = { id: `ccccccc${s.risks.length + 1}-0000-4000-8000-000000000009`, project_id: PROJECT_ID, owner_name: body.owner_id === MEMBER ? 'Mary Member' : '', score: (body.likelihood as number) * (body.impact as number), created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z', ...body };
      s.risks.unshift(row);
      return json(r, row, 201);
    }
    const sorted = [...s.risks].sort((a, b) => (b.score as number) - (a.score as number));
    return json(r, { data: sorted, total: sorted.length, limit: 500, page: 1, hasMore: false });
  });
  await page.route(new RegExp(`${p}/risks/heatmap(\\?.*)?$`), (r) => json(r, heat(new URL(r.request().url()).searchParams.get('status') === 'all')));
  await page.route(new RegExp(`${p}/risks/(?!heatmap)[^/?]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    if (r.request().method() === 'DELETE') {
      s.riskDeletes.push(id);
      s.risks = s.risks.filter((x) => x.id !== id);
      return r.fulfill({ status: 204, body: '' });
    }
    const row = s.risks.find((x) => x.id === id)!;
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON() as Row;
      s.riskPuts.push({ id, body });
      Object.assign(row, body);
      row.score = (row.likelihood as number) * (row.impact as number);
    }
    return json(r, row);
  });

  // Change requests.
  const page1 = (rows: Row[]) => ({ data: rows, total: rows.length, limit: 100, page: 1, hasMore: false });
  const byStatus = (url: string) => {
    const st = new URL(url).searchParams.get('status');
    return st ? s.changes.filter((c) => c.status === st) : s.changes;
  };
  await page.route(new RegExp(`${t}/change-requests(\\?.*)?$`), (r) => json(r, page1(byStatus(r.request().url()))));
  await page.route(new RegExp(`${p}/change-requests(\\?.*)?$`), (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() as Row;
      s.changePosts.push(body);
      const row = {
        id: `ddddddd${s.changes.length + 1}-0000-4000-8000-000000000009`,
        project_id: PROJECT_ID,
        title: body.title,
        description: body.description ?? '',
        kind: body.kind,
        status: 'pending',
        requested_by: ME,
        requested_by_name: 'Owner',
        decided_by_name: '',
        metadata: { ...(body.date_shifts ? { date_shifts: body.date_shifts } : {}), ...(body.budget ? { budget: body.budget } : {}), treasury: { status: body.budget || body.budget_id ? 'pending' : 'not_needed' } },
        created_at: '2026-11-17T08:00:00Z',
        updated_at: '2026-11-17T08:00:00Z',
      };
      s.changes.unshift(row);
      return json(r, row, 201);
    }
    return json(r, page1(byStatus(r.request().url())));
  });
  await page.route(new RegExp(`${p}/change-requests/[^/?]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    const row = s.changes.find((c) => c.id === id);
    return row ? json(r, row) : json(r, { error: 'not found', code: 'not_found' }, 404);
  });
  await page.route(new RegExp(`${p}/change-requests/[^/]+/(approve|reject|withdraw|push-budget)$`), (r) => {
    const parts = r.request().url().split('/');
    const action = parts.pop()!;
    const id = parts.pop()!;
    const row = s.changes.find((c) => c.id === id)!;
    const body = (r.request().postDataJSON() ?? {}) as Row;
    if (action === 'approve') {
      s.approves.push({ id, body });
      if (s.notPending) {
        s.notPending = false;
        return json(r, { error: 'the change request is not pending', code: 'change_request_not_pending' }, 409);
      }
      Object.assign(row, { status: 'approved', decided_by: ME, decided_by_name: 'Owner', decided_at: '2026-11-17T09:00:00Z', decision_comment: body.comment ?? '' });
    } else if (action === 'reject') {
      s.rejects.push({ id, body });
      Object.assign(row, { status: 'rejected', decided_by: ME, decided_by_name: 'Owner', decided_at: '2026-11-17T09:00:00Z', decision_comment: body.comment });
    } else if (action === 'withdraw') {
      s.withdraws.push(id);
      Object.assign(row, { status: 'withdrawn', decided_by: ME, decided_by_name: 'Owner', decided_at: '2026-11-17T09:00:00Z' });
    } else {
      s.pushes.push(id);
      const meta = row.metadata as Row;
      meta.treasury = { status: 'submitted', budget_id: 'tb-1', attempts: 2, attempted_at: '2026-11-17T09:00:00Z' };
    }
    return json(r, row);
  });

  // Templates.
  await page.route(new RegExp(`${t}/project-templates(\\?.*)?$`), (r) =>
    json(r, {
      data: [
        { id: TPL_SYSTEM, name: 'IT rollout', description: 'Discovery, build, cut-over and hand-over', category: 'IT', system: true, task_count: 24, phase_count: 4, duration_days: 56, created_at: '2026-11-01T00:00:00Z' },
        ...(s.templateDeletes.includes(TPL_OWN)
          ? []
          : [{ id: TPL_OWN, name: 'Clinic fit-out', description: 'Our usual clinic job', category: 'Fit-out', system: false, task_count: 12, phase_count: 3, duration_days: 42, created_at: '2026-11-10T00:00:00Z' }]),
      ],
      total: 2,
      limit: 100,
      page: 1,
      hasMore: false,
    }),
  );
  await page.route(new RegExp(`${t}/project-templates/[^/]+$`), (r) => {
    const id = r.request().url().split('/').pop()!;
    if (r.request().method() !== 'DELETE') return r.fallback();
    if (id === TPL_SYSTEM) return json(r, { error: 'system templates cannot be changed or deleted', code: 'system_template' }, 403);
    s.templateDeletes.push(id);
    return r.fulfill({ status: 204, body: '' });
  });
  await page.route(new RegExp(`${t}/project-templates/[^/]+/projects$`), (r) => {
    const id = r.request().url().split('/').slice(-2)[0];
    const body = r.request().postDataJSON() as Row;
    s.templateStarts.push({ id, body });
    return json(r, { project: { id: PROJECT_ID, name: body.name ?? 'IT rollout', status: 'active', currency: 'KES', owner_id: ME }, task_count: 24, milestone_count: 4, roles: [] }, 201);
  });
  await page.route(new RegExp(`${p}/save-as-template$`), (r) => {
    const body = r.request().postDataJSON() as Row;
    s.templateSaves.push(body);
    return json(r, { id: 'eeeeeee9-0000-4000-8000-000000000009', name: body.name, description: body.description ?? '', category: body.category ?? '', system: false, task_count: 4, phase_count: 0, duration_days: 11, created_at: '2026-11-17T08:00:00Z' }, 201);
  });

  // Status rules and automations.
  await page.route(new RegExp(`${p}/status-rules$`), (r) => {
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON() as PlanningState['rules'];
      s.rulesPuts.push(body as unknown as Row);
      s.rules = body;
      return json(r, body);
    }
    s.rulesCalls++;
    return json(r, s.rules);
  });
  await page.route(new RegExp(`${p}/automations$`), (r) => {
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON() as { automations: Row[] };
      s.automationPuts.push(body as unknown as Row);
      s.automations = body.automations.map((a, i) => ({ id: a.id ?? `auto-${i + 1}`, ...a }));
      return json(r, { data: s.automations, limit: 25 });
    }
    return json(r, { data: s.automations, limit: 25 });
  });
}
