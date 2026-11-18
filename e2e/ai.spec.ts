import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ORG, freshTenant, mockTenantApi, signIn } from './qa-mocks';
import { PROJECT_ID, WORK_PERMISSIONS, freshWork, mockWorkApi } from './work-mocks';
import { PLANNING_FEATURES, PLANNING_MANAGE, freshPlanning, mockPlanningApi } from './planning-mocks';
import { AI_PERMISSIONS, freshAI, mockAIApi, type AIState } from './ai-mocks';

// Sprint 10 AI assistant at phone (390 px) and desktop widths, every API call mocked. Every
// answer is a draft: nothing is saved until the person picks what to keep.

async function setup(page: Page, context: BrowserContext, baseURL: string, opts: { permissions?: string[]; ai?: Partial<AIState> } = {}) {
  const user = await signIn(context, baseURL, PLANNING_FEATURES);
  await mockTenantApi(page, freshTenant({ permissions: opts.permissions ?? [...WORK_PERMISSIONS, ...PLANNING_MANAGE, ...AI_PERMISSIONS] }), user);
  const w = freshWork();
  await mockWorkApi(page, w);
  await mockPlanningApi(page, freshPlanning(), w);
  const s = freshAI(opts.ai);
  await mockAIApi(page, s);
  return s;
}

const projectUrl = `/${ORG}/projects/${PROJECT_ID}`;

test('task drafts from a brief: only the ticked ones are created', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/tasks`);
  await page.getByRole('button', { name: 'Draft from brief' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Brief').fill('Fit out the clinic ground floor');
  await sheet.getByRole('button', { name: 'Draft tasks' }).click();
  await expect(sheet.getByTestId('draft-task')).toHaveCount(2);
  await expect(sheet.getByTestId('ai-draft-notice')).toContainText('1 AI credit used.');
  // Nothing was created by drafting.
  expect(s.taskPosts).toHaveLength(0);
  await sheet.getByRole('checkbox', { name: 'Add Draft floor plan' }).uncheck();
  await sheet.getByLabel('Title of draft 1').fill('Survey the site and services');
  await sheet.getByRole('button', { name: 'Add 1 task' }).click();
  await expect.poll(() => s.taskPosts).toEqual([{ title: 'Survey the site and services', description: 'Measure rooms and services', priority: 'high', estimated_hours: 6 }]);
  await expect(page.getByText('1 task added')).toBeVisible();
});

test('out of AI credits: a clear refusal with a top up link, and nothing is added', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { ai: { balance: 0 } });
  await page.goto(`${projectUrl}/risks`);
  await page.getByRole('button', { name: 'Suggest risks' }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Suggest risks' }).click();
  await expect(sheet.getByTestId('ai-error')).toContainText('run out of AI credits');
  await expect(sheet.getByRole('link', { name: 'Buy AI credits' })).toBeVisible();
  await expect(sheet.getByTestId('draft-risk')).toHaveCount(0);
  expect(s.calls).toHaveLength(1);
});

test('risk suggestions: the ticked risk goes to the register', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/risks`);
  await page.getByRole('button', { name: 'Suggest risks' }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Suggest risks' }).click();
  await expect(sheet.getByTestId('draft-risk')).toHaveCount(2);
  await sheet.getByRole('checkbox', { name: 'Add risk Truss delivery slips' }).check();
  const posted = page.waitForRequest((r) => r.method() === 'POST' && /\/risks$/.test(r.url()));
  await sheet.getByRole('button', { name: 'Add 1 risk' }).click();
  expect((await posted).postDataJSON()).toEqual({ title: 'Truss delivery slips', description: 'Supplier lead time', category: 'schedule', likelihood: 4, impact: 3, mitigation: 'Order this week' });
  await expect(page.getByText('1 risk added')).toBeVisible();
});

test('a provider failure charges nothing and Try again reuses the same request key', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { ai: { failNext: 1 } });
  await page.goto(`${projectUrl}/assistant`);
  await page.getByRole('radio', { name: '30 days' }).click();
  await page.getByRole('button', { name: 'Draft summary' }).click();
  await expect(page.getByTestId('ai-error')).toContainText('Nothing was charged');
  expect(s.balance).toBe(10);
  await page.getByRole('button', { name: 'Try again' }).click();
  const draft = page.getByTestId('summary-draft');
  await expect(draft).toContainText('Groundworks are late over the last 30 days.');
  await expect(draft).toContainText('At risk');
  await expect(draft).toContainText('Budget figures were left out.');
  expect(s.keys).toHaveLength(2);
  expect(s.keys[0]).toBeTruthy();
  expect(s.keys[1]).toBe(s.keys[0]);
  expect(s.balance).toBe(9);
});

test('effort estimates are saved only when used', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/assistant`);
  await page.getByRole('button', { name: 'Suggest estimates' }).click();
  await expect(page.getByTestId('draft-estimate')).toHaveCount(1);
  const ids = s.calls.find((c) => c.path === '/ai/estimates')!.body.task_ids as string[];
  expect(ids.length).toBeGreaterThan(0);
  const put = page.waitForRequest((r) => r.method() === 'PUT' && /\/tasks\/[^/]+$/.test(r.url()));
  await page.getByRole('button', { name: 'Use 8 h for Pour foundation slab' }).click();
  expect((await put).postDataJSON()).toEqual({ estimated_hours: 8 });
});

test('smart search links to the matching project', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/search`);
  await page.getByLabel('Question').fill('clinic building jobs');
  await page.getByRole('button', { name: 'Search' }).click();
  const result = page.getByTestId('search-result');
  await expect(result).toHaveCount(1);
  await expect(result.getByRole('link')).toHaveAttribute('href', `/${ORG}/projects/${PROJECT_ID}`);
});

test('the AI usage page totals requests and credits', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/settings/ai-usage`);
  await expect(page.getByTestId('ai-usage-calls')).toHaveText('2');
  await expect(page.getByTestId('ai-usage-credits')).toHaveText('1');
  await expect(page.getByText('Refused: no AI credits').filter({ visible: true }).first()).toBeVisible();
});

test('without projects.ai.add there is no AI button', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...PLANNING_MANAGE] });
  await page.goto(`${projectUrl}/tasks`);
  await expect(page.getByRole('button', { name: 'Add task' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft from brief' })).toHaveCount(0);
  await page.goto(`${projectUrl}/risks`);
  await expect(page.getByRole('button', { name: 'Add risk' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suggest risks' })).toHaveCount(0);
});
