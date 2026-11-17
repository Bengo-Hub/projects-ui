import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { ORG, freshTenant, mockTenantApi, signIn } from './qa-mocks';
import { ME, MEMBER, PROJECT_ID, T1, T2, T3, WORK_PERMISSIONS, freshWork, mockWorkApi } from './work-mocks';
import {
  BASELINE_ID,
  CR_FAILED,
  CR_MINE,
  CR_PENDING,
  PLANNING_FEATURES,
  PLANNING_MANAGE,
  PLANNING_VIEW,
  R1,
  TPL_OWN,
  TPL_SYSTEM,
  freshPlanning,
  mockPlanningApi,
  type PlanningState,
} from './planning-mocks';

// Sprint 16 planning depth at phone (390 px) and desktop widths, every API call mocked.

async function setup(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  opts: { permissions?: string[]; planning?: Partial<PlanningState>; features?: string[] } = {},
) {
  const user = await signIn(context, baseURL, opts.features ?? PLANNING_FEATURES);
  await mockTenantApi(page, freshTenant({ permissions: opts.permissions ?? [...WORK_PERMISSIONS, ...PLANNING_MANAGE] }), user);
  const w = freshWork();
  await mockWorkApi(page, w);
  const s = freshPlanning(opts.planning);
  await mockPlanningApi(page, s, w);
  return { s, w };
}

const projectUrl = `/${ORG}/projects/${PROJECT_ID}`;
const visible = (scope: Page | Locator, text: string | RegExp) => scope.getByText(text).filter({ visible: true }).first();

/** Opens a shared combobox by its current text and picks the option whose name starts with option. */
async function pick(scope: Page | Locator, trigger: string | RegExp, option: string) {
  await scope.getByRole('button', { name: trigger, exact: true }).filter({ visible: true }).first().click();
  await scope.getByRole('button', { name: new RegExp(`^${option}`) }).filter({ visible: true }).last().click();
}

// Workload.

test('the workload marks the overloaded week and a task is reassigned from its cell', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/workload`);
  await expect(page.getByRole('heading', { name: 'Workload', exact: true })).toBeVisible();
  const overloaded = page.getByRole('button', { name: /^Mary Member, W\d+, .+: 48 h of 40 h, overloaded$/ });
  await expect(overloaded).toBeVisible();
  expect(s.workloadCalls).toBeGreaterThan(0);
  // Each person says where their capacity came from.
  await expect(page.getByTestId(/^workload-row-/).first().getByTestId('capacity-source')).toHaveText('ERP: Office shift');
  await expect(page.getByTestId(/^workload-row-/).nth(1).getByTestId('capacity-source')).toHaveText('Setting');
  await expect(page.getByText(/where ERP holds one, else the workload setting/)).toBeVisible();

  await overloaded.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Order roof trusses')).toBeVisible();
  await expect(sheet.getByText('48 h across 2 tasks')).toBeVisible();
  await sheet.getByRole('button', { name: 'Reassign Order roof trusses' }).click();
  await pick(sheet, 'Hand it to', 'Owner');
  // Mary is swapped for the owner, who was already on the task, so he stays once.
  await expect.poll(() => s.taskPuts.length).toBe(1);
  expect(s.taskPuts[0]).toEqual({ taskId: T2, body: { assignee_ids: [ME] } });
  await expect(page.getByText('Task reassigned')).toBeVisible();
});

test('capacity is set in the workload settings', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/workload`);
  await page.getByRole('button', { name: 'Capacity' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Standard hours a week').fill('37.5');
  await dialog.getByRole('button', { name: 'Save capacity' }).click();
  await expect.poll(() => s.settingsPuts).toEqual([{ weekly_hours: 37.5, person_hours: {} }]);
});

test('workload without the plan feature shows the lock and calls nothing', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!, { features: PLANNING_FEATURES.filter((f) => f !== 'workload_planning') });
  await page.goto(`/${ORG}/workload`);
  await expect(page.getByRole('heading', { name: 'Workload planning is a premium feature' })).toBeVisible();
  expect(s.workloadCalls).toBe(0);
});

test('a role without workload.manage sees no capacity button', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, 'projects.workload.view'] });
  await page.goto(`/${ORG}/workload`);
  await expect(page.getByRole('button', { name: /^Mary Member, W\d+/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Capacity' })).toHaveCount(0);
});

// Baselines and slips.

test('the timeline shows the baseline, saves a new one and lists the slips', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/gantt`);
  await expect(page.getByTestId('baseline-bar')).toBeVisible();
  const phone = page.viewportSize()!.width < 640;
  if (phone) await expect(page.getByTestId('baseline-dates').filter({ visible: true }).first()).toHaveText(/^Baseline 0?[45] Nov 2026 to 0?[78] Nov 2026$/);
  else await expect(page.getByTestId(`baseline-bar-${T3}`)).toBeVisible();

  await page.getByRole('button', { name: 'Save baseline' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Baseline name').fill('Contract plan');
  await dialog.getByLabel('Baseline note').fill('Signed on Monday');
  await dialog.getByRole('button', { name: 'Save baseline' }).click();
  await expect.poll(() => s.baselinePosts).toEqual([{ name: 'Contract plan', note: 'Signed on Monday' }]);
  await expect(page.getByText(/Baseline "Contract plan" saved/)).toBeVisible();

  await page.getByRole('tab', { name: 'Slips' }).click();
  const panel = page.getByTestId('slips-panel');
  await expect(panel).toContainText('2 of 3 tasks slipped, the worst by 4 days.');
  await expect(visible(panel, 'Cure slab')).toBeVisible();
  await expect(visible(panel, '4 days late')).toBeVisible();
  await expect(visible(panel, 'Shell complete')).toBeVisible();
  await expect(page.getByTestId('slips-added-removed')).toContainText('1 task added');
});

test('a baseline is deleted after a confirm', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/gantt`);
  await page.getByRole('button', { name: 'Delete baseline Signed-off plan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete baseline' }).click();
  await expect.poll(() => s.baselineDeletes).toEqual([BASELINE_ID]);
});

test('a viewer sees baselines without save or delete, and no plan means no baseline calls', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...PLANNING_VIEW] });
  await page.goto(`${projectUrl}/gantt`);
  await expect(page.getByTestId('baseline-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save baseline' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Delete baseline/ })).toHaveCount(0);
});

test('without the Gantt feature the timeline is locked and baselines are never asked for', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!, { features: PLANNING_FEATURES.filter((f) => f !== 'gantt_chart') });
  await page.goto(`${projectUrl}/gantt`);
  await expect(page.getByRole('heading', { name: 'Gantt charts are a premium feature' })).toBeVisible();
  expect(s.baselineCalls).toBe(0);
});

// Risks.

test('a risk is raised with a score preview and the heat map filters the register', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/risks`);
  await expect(visible(page, 'Steel delivery runs late')).toBeVisible();
  await expect(visible(page, 'Rain delays the slab')).toBeVisible();

  await page.getByTestId('heat-4-4').click();
  await expect(page.getByTestId('risk-cell-filter')).toContainText('Likelihood 4, impact 4: 1 risk');
  await expect(visible(page, 'Steel delivery runs late')).toBeVisible();
  await expect(page.getByText('Rain delays the slab').filter({ visible: true })).toHaveCount(0);
  await page.getByTestId('heat-4-4').click();
  await expect(visible(page, 'Rain delays the slab')).toBeVisible();

  await page.getByRole('button', { name: 'Add risk' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Risk title').fill('Crane hire falls through');
  await dialog.getByRole('radio', { name: 'Likelihood 5, Almost certain' }).click();
  await dialog.getByRole('radio', { name: 'Impact 4, Major' }).click();
  await expect(dialog.getByTestId('risk-score-preview')).toHaveText('20, Critical');
  await pick(dialog, 'No owner', 'Mary Member');
  await dialog.getByLabel('Mitigation').fill('Book a second crane');
  await dialog.getByRole('button', { name: 'Add risk' }).click();
  await expect.poll(() => s.riskPosts).toEqual([
    { title: 'Crane hire falls through', likelihood: 5, impact: 4, status: 'open', owner_id: MEMBER, mitigation: 'Book a second crane' },
  ]);
  await expect(page.getByTestId('heat-5-4')).toHaveText('1');
});

test('a risk is edited as a patch and deleted after a confirm', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/risks`);
  await visible(page, 'Steel delivery runs late').click();
  const dialog = page.getByRole('dialog');
  await pick(dialog, 'Open', 'Mitigated');
  await dialog.getByRole('button', { name: 'Save risk' }).click();
  await expect.poll(() => s.riskPuts).toEqual([{ id: R1, body: { status: 'mitigated' } }]);

  await page.getByRole('button', { name: 'Delete risk Rain delays the slab' }).filter({ visible: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete risk' }).click();
  await expect.poll(() => s.riskDeletes.length).toBe(1);
});

test('a viewer reads the register without add, edit or delete', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...PLANNING_VIEW] });
  await page.goto(`${projectUrl}/risks`);
  await expect(visible(page, 'Steel delivery runs late')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add risk' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Delete risk/ })).toHaveCount(0);
  await visible(page, 'Steel delivery runs late').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Risk title')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Save risk' })).toHaveCount(0);
});

// Change requests.

test('a schedule change is raised from the project', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(projectUrl);
  await page.getByRole('link', { name: 'Changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Changes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Raise change' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Change title').fill('Cure the slab later');
  await dialog.getByRole('radio', { name: 'Schedule' }).click();
  await dialog.getByRole('button', { name: 'Add a task' }).click();
  await pick(dialog, 'Pick a task', 'Cure slab');
  await dialog.getByLabel('Days to move Cure slab').fill('3');
  await expect(dialog.getByText(/3 days later, due 15 Nov 2026 instead of 1[12] Nov 2026/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Raise change' }).click();
  await expect.poll(() => s.changePosts).toEqual([{ title: 'Cure the slab later', kind: 'schedule', date_shifts: [{ task_id: T3, shift_days: 3 }] }]);
  await expect(page.getByText('Change request raised. It waits for approval.')).toBeVisible();
});

test('a cost change carries new budget lines', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/changes`);
  await page.getByRole('button', { name: 'Raise change' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Change title').fill('More steel');
  await dialog.getByRole('radio', { name: 'Cost' }).click();
  await dialog.getByLabel('Line 1 name').fill('Steel beams');
  await dialog.getByLabel('Line 1 amount').fill('120000');
  await dialog.getByRole('button', { name: 'Raise change' }).click();
  await expect.poll(() => s.changePosts.length).toBe(1);
  const body = s.changePosts[0] as { kind: string; budget: { currency: string; lines: unknown[] } };
  expect(body.kind).toBe('cost');
  expect(body.budget.currency).toBe('KES');
  expect(body.budget.lines).toEqual([{ category: 'expense', name: 'Steel beams', planned_amount: '120000' }]);
});

test('an approver approves with a comment, and a reject needs one', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/changes?cr=${CR_PENDING}`);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('The concrete plant is closed for maintenance.')).toBeVisible();
  await expect(sheet.getByTestId('change-shifts')).toContainText('7 days later');

  await sheet.getByRole('button', { name: 'Reject' }).click();
  await expect(sheet.getByText('Say why the change is rejected.')).toBeVisible();
  expect(s.rejects).toHaveLength(0);

  await sheet.getByLabel('Decision comment').fill('Fine, the plant reopens on the 20th');
  await sheet.getByRole('button', { name: 'Approve' }).click();
  await expect.poll(() => s.approves).toEqual([{ id: CR_PENDING, body: { comment: 'Fine, the plant reopens on the 20th' } }]);
  await expect(sheet.getByText('Approved', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Approve' })).toHaveCount(0);
});

test('a refused approval says why', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { planning: { notPending: true } });
  await page.goto(`${projectUrl}/changes?cr=${CR_PENDING}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('This change was already decided or withdrawn. Reload to see where it stands.')).toBeVisible();
});

test('my own request cannot be decided by me but can be withdrawn', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/changes?cr=${CR_MINE}`);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('own-request-note')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Withdraw the change' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect.poll(() => s.withdraws).toEqual([CR_MINE]);
});

test('a failed treasury push is retried', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/changes?cr=${CR_FAILED}`);
  const status = page.getByTestId('treasury-status');
  await expect(status).toContainText('Treasury did not take it');
  await expect(status).toContainText('budget period overlaps a closed period');
  await status.getByRole('button', { name: 'Retry the push' }).click();
  await expect.poll(() => s.pushes).toEqual([CR_FAILED]);
  await expect(status).toContainText('Submitted for approval in treasury');
});

test('the approvals queue lists pending changes across projects', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/approvals`);
  await expect(page.getByRole('heading', { name: 'Approvals', exact: true })).toBeVisible();
  await expect(visible(page, 'Move the slab a week')).toBeVisible();
  await expect(visible(page, 'Riverside clinic fit-out')).toBeVisible();
  // Approved ones are not waiting.
  await expect(page.getByText('Extra steel budget').filter({ visible: true })).toHaveCount(0);
  await visible(page, 'Move the slab a week').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Approve' }).click();
  await expect.poll(() => s.approves.map((a) => a.id)).toEqual([CR_PENDING]);
});

test('a viewer sees change requests without raise, decide or withdraw', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...PLANNING_VIEW] });
  await page.goto(`${projectUrl}/changes?cr=${CR_PENDING}`);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('The concrete plant is closed for maintenance.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Withdraw the change' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Raise change' })).toHaveCount(0);
});

// Templates.

test('a project starts from a template and opens', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects`);
  await page.getByRole('button', { name: 'New from template' }).click();
  const dialog = page.getByRole('dialog');
  const gallery = dialog.getByTestId('template-gallery');
  await expect(gallery.getByRole('button').first()).toHaveAccessibleName('Use template IT rollout');
  // Starter templates come with the app and cannot be deleted.
  await expect(dialog.getByRole('button', { name: 'Delete template IT rollout' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Use template IT rollout' }).click();
  await dialog.getByLabel('Project name').fill('Head office rollout');
  await dialog.getByLabel('Start date').fill('2026-12-01');
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect.poll(() => s.templateStarts).toEqual([{ id: TPL_SYSTEM, body: { start_date: '2026-12-01', name: 'Head office rollout' } }]);
  await expect(page).toHaveURL(new RegExp(`/${ORG}/projects/${PROJECT_ID}$`));
});

test('an own template is deleted and a project is saved as a template', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects`);
  await page.getByRole('button', { name: 'New from template' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete template Clinic fit-out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete template', exact: true }).click();
  await expect.poll(() => s.templateDeletes).toEqual([TPL_OWN]);

  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Save as template' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Template name')).toHaveValue('Riverside clinic fit-out');
  await dialog.getByLabel('Template category').fill('Fit-out');
  await dialog.getByRole('button', { name: 'Save template' }).click();
  await expect.poll(() => s.templateSaves).toEqual([{ name: 'Riverside clinic fit-out', category: 'Fit-out' }]);
});

test('a viewer has no template buttons', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { permissions: [...WORK_PERMISSIONS, ...PLANNING_VIEW] });
  await page.goto(`/${ORG}/projects`);
  await expect(visible(page, 'Riverside clinic fit-out')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New from template' })).toHaveCount(0);
  await page.goto(projectUrl);
  await expect(page.getByRole('heading', { name: 'Riverside clinic fit-out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save as template' })).toHaveCount(0);
});

// Recurring tasks.

test('a repeat rule is set in the drawer and marks the card', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/tasks?task=${T1}`);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByTestId('repeat-text')).toHaveText('Does not repeat');
  await pick(drawer, 'Does not repeat', 'Every week');
  await drawer.getByRole('button', { name: 'Save repeat' }).click();
  await expect.poll(() => s.taskPuts.length).toBe(1);
  expect((s.taskPuts[0].body.metadata as { repeat: unknown }).repeat).toEqual({ freq: 'weekly', interval: 1 });
  await expect(drawer.getByTestId('repeat-text')).toHaveText('Repeats every week');
  await drawer.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('column-todo').getByTestId('repeat-icon')).toHaveAttribute('aria-label', 'Repeats every week');
});

test('a repeat rule the API refuses shows its reason', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { planning: { refuseRepeat: true } });
  await page.goto(`${projectUrl}/tasks?task=${T1}`);
  const drawer = page.getByRole('dialog');
  await pick(drawer, 'Does not repeat', 'Every few days');
  await drawer.getByLabel('Repeat every').fill('3');
  await drawer.getByRole('button', { name: 'Save repeat' }).click();
  await expect(page.getByText('repeat.interval must be between 1 and 365')).toBeVisible();
});

// Status rules and automations.

const blockedReview = {
  [T1]: [
    { status: 'in_progress', allowed: true, missing_fields: [] },
    { status: 'review', allowed: false, reason: 'missing_fields', missing_fields: ['estimated_hours'], message: 'Before moving to In review, this task needs an estimate.' },
    { status: 'done', allowed: true, missing_fields: [] },
  ],
};

async function drag(page: Page, from: Locator, to: Locator, before?: () => Promise<void>) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + 10, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + 20, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + 30, { steps: 12 });
  if (before) await before();
  // dnd-kit scrolls the board sideways while the pointer is near its edge, so measure the target
  // again and release over it where it is now.
  const c = (await to.boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + 30, { steps: 4 });
  await page.mouse.up();
}

test('a blocked column says why during the drag and the card stays', async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'mouse drag; the phone path is the drawer status menu below');
  const { s } = await setup(page, context, baseURL!, { planning: { moves: blockedReview } });
  await page.goto(`${projectUrl}/tasks`);
  const card = page.getByTestId('column-todo').getByRole('button', { name: 'Pour foundation slab', exact: true });
  await drag(page, card, page.getByTestId('column-review').locator('ul'), async () => {
    await expect(page.getByTestId('blocked-review')).toHaveText('Before moving to In review, this task needs an estimate.');
  });
  await expect(page.getByText('Before moving to In review, this task needs an estimate.').first()).toBeVisible();
  expect(s.statusPatches).toHaveLength(0);
  await expect(page.getByTestId('column-todo').getByRole('button', { name: 'Pour foundation slab', exact: true })).toBeVisible();
});

test('a 422 status_rule_blocked from a drag shows the message and snaps the card back', async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'mouse drag');
  const { s } = await setup(page, context, baseURL!, { planning: { rejectStatus: true } });
  await page.goto(`${projectUrl}/tasks`);
  const card = page.getByTestId('column-todo').getByRole('button', { name: 'Pour foundation slab', exact: true });
  await drag(page, card, page.getByTestId('column-done').locator('ul'));
  await expect.poll(() => s.statusPatches.length).toBe(1);
  await expect(page.getByText('Before moving to Done, this task needs actual hours.')).toBeVisible();
  await expect(page.getByTestId('column-todo').getByRole('button', { name: 'Pour foundation slab', exact: true })).toBeVisible();
  await expect(page.getByTestId('column-done').getByRole('button', { name: 'Pour foundation slab', exact: true })).toHaveCount(0);
});

test('the drawer status menu names a blocked move and does not send it', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!, { planning: { moves: blockedReview } });
  await page.goto(`${projectUrl}/tasks?task=${T1}`);
  const drawer = page.getByRole('dialog');
  await pick(drawer, 'To do', 'In review');
  await expect(drawer.getByTestId('status-blocked')).toHaveText('Before moving to In review, this task needs an estimate.');
  expect(s.statusPatches).toHaveLength(0);
});

test('status rules and an automation are saved from the automation tab', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(projectUrl);
  await page.getByRole('link', { name: 'Automation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Automation', exact: true })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Allow To do to Done' }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Done needs actual hours' }).click();
  await page.getByRole('button', { name: 'Save status rules' }).click();
  await expect.poll(() => s.rulesPuts).toEqual([
    { transitions: [{ from: 'todo', to: ['in_progress', 'review'] }], requirements: [{ to: 'done', fields: ['actual_hours'] }] },
  ]);

  await page.getByRole('button', { name: 'Add automation' }).click();
  await page.getByLabel('Automation 1 name').fill('Tell the team when done');
  await page.getByRole('button', { name: 'Save automations' }).click();
  await expect.poll(() => s.automationPuts).toEqual([
    { automations: [{ name: 'Tell the team when done', enabled: true, trigger: { to: 'done' }, actions: [{ type: 'notify', recipients: ['assignees'] }] }] },
  ]);
});

test('an automation without a name is not sent', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!);
  await page.goto(`${projectUrl}/automation`);
  await page.getByRole('button', { name: 'Add automation' }).click();
  await page.getByRole('button', { name: 'Save automations' }).click();
  await expect(page.getByText('Automation 1 needs a name of at most 120 characters.')).toBeVisible();
  expect(s.automationPuts).toHaveLength(0);
});

test('automation.view reads the rules without editing them', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, {
    permissions: [...WORK_PERMISSIONS, 'projects.automation.view'],
    planning: {
      rules: { transitions: [{ from: 'todo', to: ['in_progress'] }], requirements: [] },
      automations: [{ id: 'a1', name: 'QA hand-off', enabled: true, trigger: { to: 'review' }, actions: [{ type: 'assign', user_ids: [MEMBER], mode: 'add' }] }],
    },
  });
  await page.goto(`${projectUrl}/automation`);
  await expect(page.getByRole('checkbox', { name: 'Allow To do to Done' }).filter({ visible: true })).toBeDisabled();
  await expect(page.getByTestId('automation-summaries')).toContainText('When a task moves to In review: also assign Mary Member.');
  await expect(page.getByRole('button', { name: 'Save status rules' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add automation' })).toHaveCount(0);
});

test('without project_automation the tab is locked and the rules are never asked for', async ({ page, context, baseURL }) => {
  const { s } = await setup(page, context, baseURL!, { features: PLANNING_FEATURES.filter((f) => f !== 'project_automation') });
  await page.goto(projectUrl);
  await expect(page.getByRole('link', { name: /^Automation/ })).toHaveAttribute('title', 'Upgrade to unlock Automation');
  await page.goto(`${projectUrl}/automation`);
  await expect(page.getByRole('heading', { name: 'Status rules and automations are a premium feature' })).toBeVisible();
  expect(s.rulesCalls).toBe(0);
});
