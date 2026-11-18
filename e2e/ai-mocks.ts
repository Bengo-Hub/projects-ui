import type { Page } from '@playwright/test';
import { ORG, json } from './qa-mocks';
import { PROJECT_ID, T1 } from './work-mocks';

// Mocks for the sprint 10 AI assistant: projects-api's AI routes with a fake model answer and a
// fake AI credit balance. A call costs one credit only when it answers; a refusal or a provider
// failure costs nothing, as on the server.

export const AI_PERMISSIONS = ['projects.ai.add', 'projects.ai.view'];

type Row = Record<string, unknown>;

export interface AIState {
  /** AI credits left; 0 refuses with ai_credits_exhausted. */
  balance: number;
  /** The next N calls answer 503 ai_unavailable. */
  failNext: number;
  /** Idempotency-Key of every AI call, in order. */
  keys: string[];
  calls: { path: string; body: Row }[];
  taskPosts: Row[];
}

export function freshAI(over: Partial<AIState> = {}): AIState {
  return { balance: 10, failNext: 0, keys: [], calls: [], taskPosts: [], ...over };
}

const credits = { charged: 1, exempt: false, replayed: false };
const review = { review_notes: [], tainted: false, stopped_early: false };

function answer(path: string, body: Row): Row {
  if (path.endsWith('/task-breakdown')) {
    return {
      draft: true, project_id: PROJECT_ID, parent_task_id: null, ...review, credits,
      tasks: [
        { title: 'Survey the site', description: 'Measure rooms and services', priority: 'high', estimated_hours: 6 },
        { title: 'Draft floor plan', description: '', priority: 'medium', estimated_hours: null },
      ],
    };
  }
  if (path.endsWith('/status-summary')) {
    return {
      draft: true, project_id: PROJECT_ID, period_from: '2026-11-03T00:00:00Z', period_to: '2026-11-17T00:00:00Z', ...review, credits,
      health: 'at_risk', summary: `Groundworks are late over the last ${body.period_days ?? 14} days.`,
      accomplishments: ['Foundation slab poured'], next_steps: ['Order roof trusses'], issues: ['Two tasks overdue'], includes_financials: false,
    };
  }
  if (path.endsWith('/risk-suggestions')) {
    return {
      draft: true, project_id: PROJECT_ID, ...review, credits,
      risks: [
        { title: 'Truss delivery slips', description: 'Supplier lead time', category: 'schedule', likelihood: 4, impact: 3, mitigation: 'Order this week' },
        { title: 'Client sign-off late', description: '', category: 'client', likelihood: 2, impact: 4, mitigation: '' },
      ],
    };
  }
  if (path.endsWith('/estimates')) {
    return {
      draft: true, project_id: PROJECT_ID, ...review, credits,
      estimates: [{ task_id: T1, title: 'Pour foundation slab', current_hours: null, estimated_hours: 8, confidence: 'medium', reasoning: 'Like the earlier pours.' }],
    };
  }
  return {
    query: body.query, ...review, credits,
    results: [{ kind: 'project', id: PROJECT_ID, title: 'Riverside clinic fit-out', status: 'active', reason: 'A clinic building job.', rank: 1 }],
  };
}

export async function mockAIApi(page: Page, s: AIState) {
  const t = `/api/v1/${ORG}`;
  const p = `${t}/projects/${PROJECT_ID}`;
  const handle = (path: string) => async (r: import('@playwright/test').Route) => {
    const body = (r.request().postDataJSON() ?? {}) as Row;
    s.keys.push(r.request().headers()['idempotency-key'] ?? '');
    s.calls.push({ path, body });
    if (s.balance < 1) {
      return json(r, { error: 'Not enough AI credits.', code: 'ai_credits_exhausted', reason: 'insufficient_credits' }, 402);
    }
    if (s.failNext > 0) {
      s.failNext--;
      return json(r, { error: 'AI is unavailable right now; nothing was charged', code: 'ai_unavailable' }, 503);
    }
    s.balance--;
    return json(r, answer(path, body));
  };
  for (const f of ['task-breakdown', 'status-summary', 'risk-suggestions', 'estimates']) {
    await page.route(new RegExp(`${p}/ai/${f}$`), handle(`/ai/${f}`));
  }
  await page.route(new RegExp(`${t}/ai/search$`), handle('/ai/search'));
  await page.route(new RegExp(`${t}/ai/usage(\\?.*)?$`), (r) =>
    json(r, {
      since: '2026-10-18T00:00:00Z', total: 2, limit: 50, offset: 0,
      totals: [{ feature: 'task_breakdown', calls: 2, completed: 1, credits: 1, total_tokens: 900 }],
      items: [
        { id: 'u1', user_id: null, project_id: PROJECT_ID, feature: 'task_breakdown', status: 'completed', credits_charged: 1, exempt: false, total_tokens: 900, created_at: '2026-11-17T08:00:00Z' },
        { id: 'u2', user_id: null, project_id: PROJECT_ID, feature: 'task_breakdown', status: 'refused', reason: 'insufficient_credits', credits_charged: 0, exempt: false, total_tokens: 0, created_at: '2026-11-17T07:00:00Z' },
      ],
    }),
  );
  // Accepted task drafts go through the ordinary task create; reads fall through to the work mock.
  await page.route(new RegExp(`${p}/tasks(\\?.*)?$`), (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    const body = r.request().postDataJSON() as Row;
    s.taskPosts.push(body);
    return json(r, { id: `task-${s.taskPosts.length}`, project_id: PROJECT_ID, status: 'todo', ...body }, 201);
  });
}
