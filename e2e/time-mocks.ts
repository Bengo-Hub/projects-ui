import type { Page } from '@playwright/test';
import { ORG, json } from './qa-mocks';
import { PROJECT_ID, T1 } from './work-mocks';
import { weekDays } from '../src/lib/work/time';

// Mocks for the sprint 13 time screens (timer, week, submit). Add after mockTenantApi and
// mockWorkApi: Playwright tries the most recently added route first.

/** A fixed fee project: hours are never billable there, so no switch shows. */
export const FIXED_ID = '99999999-9999-4999-8999-999999999999';

export const TIME_PERMISSIONS = ['projects.time.view_own', 'projects.time.add'];

interface Cell {
  project_id: string;
  project_name: string;
  task_id: string | null;
  task_title?: string;
  billable: boolean;
  hours: Record<string, number>;
}

export interface TimeState {
  timer: { project_id: string; task_id: string; task_title: string; started_at: string } | null;
  starts: string[];
  stops: Record<string, unknown>[];
  puts: Record<string, unknown>[];
  submits: Record<string, unknown>[];
  submitted: boolean;
  noEmployee: boolean;
  rows: Cell[];
}

/** Two rows on the week's Monday: 2 h on the time and materials project, 1 h on the fixed fee one. */
export function freshTime(monday: string): TimeState {
  return {
    timer: null,
    starts: [],
    stops: [],
    puts: [],
    submits: [],
    submitted: false,
    noEmployee: false,
    rows: [
      { project_id: PROJECT_ID, project_name: 'Riverside clinic fit-out', task_id: T1, task_title: 'Pour foundation slab', billable: true, hours: { [monday]: 2 } },
      { project_id: FIXED_ID, project_name: 'Head office refit', task_id: null, billable: false, hours: { [monday]: 1 } },
    ],
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function weekBody(s: TimeState, start: string) {
  const days = weekDays(start);
  const rows = s.rows.map((r) => ({ ...r, total: round2(days.reduce((sum, d) => sum + (r.hours[d] ?? 0), 0)) }));
  const day_totals = Object.fromEntries(days.map((d) => [d, round2(rows.reduce((sum, r) => sum + (r.hours[d] ?? 0), 0))]));
  const total = round2(rows.reduce((sum, r) => sum + r.total, 0));
  const billable_total = round2(rows.filter((r) => r.billable).reduce((sum, r) => sum + r.total, 0));
  return {
    week_start: start,
    week_end: days[6],
    days,
    status: s.submitted ? 'submitted' : 'draft',
    editable: !s.submitted,
    timesheets: [{ id: 'ts1', period_start: start, period_end: days[6], status: s.submitted ? 'submitted' : 'draft', editable: !s.submitted }],
    rows,
    day_totals,
    total,
    billable_total,
  };
}

export async function mockTimeApi(page: Page, s: TimeState) {
  const t = `/api/v1/${ORG}`;
  await page.route(new RegExp(`${t}/projects(\\?.*)?$`), (r) =>
    json(r, {
      data: [
        { id: PROJECT_ID, name: 'Riverside clinic fit-out', status: 'active', currency: 'KES', owner_id: 'o', created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', metadata: { billing_type: 'time_and_materials' } },
        { id: FIXED_ID, name: 'Head office refit', status: 'active', currency: 'KES', owner_id: 'o', created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', metadata: { billing_type: 'fixed' } },
      ],
      total: 2,
      limit: 100,
      page: 1,
      hasMore: false,
    }),
  );
  await page.route(new RegExp(`${t}/time/week(\\?.*)?$`), (r) => {
    if (s.noEmployee) return json(r, { error: 'no employee record for this user: ask HR to link your account to an employee in ERP', code: 'no_employee_record' }, 409);
    const start = new URL(r.request().url()).searchParams.get('week_start') ?? '';
    return json(r, weekBody(s, start));
  });
  await page.route(new RegExp(`${t}/time/entries$`), (r) => {
    const body = r.request().postDataJSON() as { project_id: string; task_id?: string; date: string; hours: number; billable?: boolean };
    s.puts.push(body);
    const row = s.rows.find((x) => x.project_id === body.project_id && (x.task_id ?? undefined) === body.task_id);
    if (row) {
      row.hours[body.date] = body.hours;
      if (body.billable !== undefined) row.billable = body.billable;
    }
    return json(r, { employee_id: 'e1', timesheet: {}, entry: {} });
  });
  await page.route(new RegExp(`${t}/time/week/submit(\\?.*)?$`), (r) => {
    s.submits.push(r.request().postDataJSON() as Record<string, unknown>);
    s.submitted = true;
    return json(r, { data: [] });
  });
  await page.route(new RegExp(`${t}/time/timer$`), (r) => json(r, { data: s.timer }));
  await page.route(new RegExp(`${t}/time/timer/stop(\\?.*)?$`), (r) => {
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.stops.push(body);
    s.timer = null;
    return json(r, { segments: [{ date: String(body.stopped_at).slice(0, 10), hours: 0.08 }], entries: [] });
  });
  await page.route(new RegExp(`${t}/tasks/[^/]+/timer(\\?.*)?$`), (r) => {
    const taskId = new URL(r.request().url()).pathname.split('/').slice(-2)[0];
    const method = r.request().method();
    if (method === 'POST') {
      s.starts.push(taskId);
      s.timer = { project_id: PROJECT_ID, task_id: taskId, task_title: 'Pour foundation slab', started_at: new Date(Date.now() - 5 * 60_000).toISOString() };
      return json(r, { timer: s.timer, stopped: [] });
    }
    if (method === 'DELETE') {
      s.timer = null;
      return r.fulfill({ status: 204, body: '' });
    }
    return json(r, { data: s.timer && s.timer.task_id === taskId ? s.timer : null });
  });
}
