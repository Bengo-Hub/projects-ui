import { expect, test } from '@playwright/test';
import { ORG, freshTenant, mockTenantApi, signIn } from './qa-mocks';
import { PROJECT_ID, T1, T3, T4, WORK_PERMISSIONS, freshWork, mockWorkApi } from './work-mocks';

// Sprint 12 work screens at phone (390 px) and desktop widths, every API call mocked.

async function setup(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext, baseURL: string) {
  const s = freshTenant({ permissions: WORK_PERMISSIONS });
  const user = await signIn(context, baseURL);
  await mockTenantApi(page, s, user);
  const w = freshWork();
  await mockWorkApi(page, w);
  return w;
}

const tasksUrl = `/${ORG}/projects/${PROJECT_ID}/tasks`;

test('a notification link with ?task= opens the drawer over the board', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!);
  await page.goto(`${tasksUrl}?task=${T1}`);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'Pour foundation slab' })).toBeVisible();
  await expect(drawer.getByText('Book concrete')).toBeVisible();
  // Full screen on a phone, a side sheet on desktop.
  const box = await drawer.boundingBox();
  const vw = page.viewportSize()!.width;
  if (vw < 768) expect(Math.round(box!.width)).toBe(vw);
  else expect(box!.width).toBeLessThan(vw);
  await drawer.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(new RegExp(`${tasksUrl}$`));
  await expect(page.getByTestId('column-todo')).toBeVisible();
});

test('dragging a card to another column moves it with an Idempotency-Key', async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'mouse drag; phones use a long press, covered by the drawer status field');
  const w = await setup(page, context, baseURL!);
  await page.goto(tasksUrl);
  const card = page.getByTestId('column-todo').getByRole('button', { name: 'Pour foundation slab', exact: true });
  await expect(card).toBeVisible();
  const target = page.getByTestId('column-review').locator('ul');
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 10, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 30, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => w.statusPatches.length).toBe(1);
  expect(w.statusPatches[0]).toMatchObject({ taskId: T1, status: 'review' });
  expect(w.statusPatches[0].key).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByTestId('column-review').getByRole('button', { name: 'Pour foundation slab', exact: true })).toBeVisible();
});

test('the assignee picker offers project members only, named without the role screens', async ({ page, context, baseURL }) => {
  const w = await setup(page, context, baseURL!);
  await page.goto(tasksUrl);
  await page.getByRole('button', { name: 'Add task' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Assign people').click();
  await expect(page.getByText('Mary Member').first()).toBeVisible();
  await expect(page.getByText('Owner (you)').first()).toBeVisible();
  // Olive signed in to projects but is not on this project, so she cannot be picked.
  await expect(page.getByText('Olive Outsider')).toHaveCount(0);
  expect(w.rbacUserCalls).toBe(0);
});

test('comment authors and the activity feed show names for a user without rbac.manage', async ({ page, context, baseURL }) => {
  const w = await setup(page, context, baseURL!);
  await page.goto(`${tasksUrl}?task=${T1}`);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Concrete booked for Monday.')).toBeVisible();
  await expect(drawer.getByText('Mary Member').first()).toBeVisible();
  await drawer.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(drawer.getByText('updated the task')).toBeVisible();
  expect(w.rbacUserCalls).toBe(0);
});

test('checklist edits go out as single operations with an Idempotency-Key', async ({ page, context, baseURL }) => {
  const w = await setup(page, context, baseURL!);
  await page.goto(`${tasksUrl}?task=${T1}`);
  const drawer = page.getByRole('dialog');
  await drawer.getByLabel('Tick Book concrete').click();
  await expect.poll(() => w.checklistPatches.length).toBe(1);
  expect(w.checklistPatches[0]).toMatchObject({ taskId: T1, body: { op: 'toggle', item_id: 'c1', done: true } });
  expect(w.checklistPatches[0].key).toMatch(/^[0-9a-f-]{36}$/);

  await drawer.getByLabel('New checklist item').fill('Check the weather');
  await drawer.getByLabel('New checklist item').press('Enter');
  await expect.poll(() => w.checklistPatches.length).toBe(2);
  expect(w.checklistPatches[1].body).toMatchObject({ op: 'add', text: 'Check the weather' });
  expect(w.checklistPatches[1].key).not.toBe(w.checklistPatches[0].key);
  await expect(drawer.getByText('1 of 2 done')).toBeVisible();
});

test('a comment posts with its own Idempotency-Key', async ({ page, context, baseURL }) => {
  const w = await setup(page, context, baseURL!);
  await page.goto(`${tasksUrl}?task=${T1}`);
  const drawer = page.getByRole('dialog');
  const editor = drawer.getByLabel('New comment');
  await editor.click();
  await page.keyboard.type('Pump truck confirmed');
  await drawer.getByRole('button', { name: 'Post comment' }).click();
  await expect.poll(() => w.commentPosts.length).toBe(1);
  expect(w.commentPosts[0].taskId).toBe(T1);
  expect(String(w.commentPosts[0].body.content)).toContain('Pump truck confirmed');
  expect(w.commentPosts[0].key).toMatch(/^[0-9a-f-]{36}$/);
});

test('subtasks load through ?parent_id instead of the whole task list', async ({ page, context, baseURL }) => {
  const w = await setup(page, context, baseURL!);
  await page.goto(`${tasksUrl}?task=${T1}`);
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('button', { name: 'Subtasks', exact: true }).click();
  await expect(drawer.getByRole('button', { name: /Check rebar spacing/ })).toBeVisible();
  expect(w.parentQueries).toContain(T1);
  await drawer.getByRole('button', { name: /Check rebar spacing/ }).click();
  await expect(page).toHaveURL(new RegExp(`task=${T4}`));
});

test('the project files page lists project and task files and removes one after confirming', async ({ page, context, baseURL }) => {
  const w = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/files`);
  // The shared data table renders a grid on desktop and cards on phones; only one is visible.
  const shown = <T extends import('@playwright/test').Locator>(l: T) => l.filter({ visible: true }).first();
  await expect(page.getByRole('heading', { name: 'Files (2)' })).toBeVisible();
  await expect(shown(page.getByText('site-plan.pdf'))).toBeVisible();
  await expect(shown(page.getByText('slab-photo.jpg'))).toBeVisible();
  // The project file is on the project; the task file links to its task.
  await expect(shown(page.getByRole('link', { name: 'A task' }))).toHaveAttribute('href', new RegExp(`task=${T1}`));
  await expect(shown(page.getByText('Mary Member'))).toBeVisible();

  await shown(page.getByRole('button', { name: 'Remove slab-photo.jpg' })).click();
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await confirm.getByRole('button', { name: 'Remove' }).click();
  await expect.poll(() => w.deletedFiles).toEqual(['tf1']);

  await page.getByLabel('Choose files to attach').setInputFiles({ name: 'handover.txt', mimeType: 'text/plain', buffer: Buffer.from('hello, slab!') });
  await expect.poll(() => w.uploads.confirmed.length).toBe(1);
  expect(w.uploads.requested[0].task_id).toBeUndefined();
});

test('the phone board moves a card with a long press and a drag', async ({ page, context, baseURL, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone' || browserName !== 'chromium', 'real touch input comes from the Chromium DevTools protocol');
  const w = await setup(page, context, baseURL!);
  await page.goto(tasksUrl);
  const card = page.getByTestId('column-todo').getByRole('button', { name: 'Pour foundation slab', exact: true });
  await expect(card).toBeVisible();
  const from = (await card.boundingBox())!;
  const x = from.x + 20;
  const y = from.y + from.height / 2;
  // dnd-kit's TouchSensor listens to real touch events and starts after a 250 ms press that moves
  // under 8 px; CDP sends the same touch events a finger does.
  const cdp = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', px?: number, py?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: px === undefined ? [] : [{ x: Math.round(px), y: Math.round(py!) }] });
  await touch('touchStart', x, y);
  await page.waitForTimeout(400);
  // Stay left of the auto-scroll band (the last fifth of the board) so the board holds still and
  // the card lands on the next column, which peeks in at the right edge.
  const dx = 250;
  for (let i = 1; i <= 10; i++) await touch('touchMove', x + (dx * i) / 10, y + 10);
  await page.waitForTimeout(100);
  await touch('touchEnd');

  await expect.poll(() => w.statusPatches.length).toBe(1);
  expect(w.statusPatches[0]).toMatchObject({ taskId: T1, status: 'in_progress' });
  expect(w.statusPatches[0].key).toMatch(/^[0-9a-f-]{36}$/);
});

test('the Gantt page paints the chart on desktop without mounting the phone list', async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'desktop layout');
  await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/gantt`);
  await expect(page.getByTestId('gantt-chart-pane')).toBeVisible();
  await expect(page.getByTestId('gantt-list-pane')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show the chart' })).toHaveCount(0);
});

test('My Work groups my tasks by when they are due and opens the drawer', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/my-work`);
  await expect(page.getByTestId('bucket-overdue').getByText('Pour foundation slab')).toBeVisible();
  await expect(page.getByTestId('bucket-week').getByText('Cure slab')).toBeVisible();
  await expect(page.getByTestId('bucket-today').getByText('Nothing due today.')).toBeVisible();
  await page.getByTestId('bucket-overdue').getByRole('button', { name: /Pour foundation slab/ }).click();
  await expect(page).toHaveURL(new RegExp(`task=${T1}.*project=${PROJECT_ID}`));
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pour foundation slab' })).toBeVisible();
});

test('the Gantt chart marks the critical path and names the task blocking a move', async ({ page, context, baseURL }, testInfo) => {
  const w = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/gantt`);
  await expect(page.getByText(/Critical path: 2 tasks over 11 days/)).toBeVisible();

  if (testInfo.project.name === 'phone') {
    // Below 640 px the plan is a list first, the chart one tap away.
    await expect(page.getByTestId('gantt-list').getByText('Critical').first()).toBeVisible();
    await page.getByRole('button', { name: 'Show the chart' }).click();
    await expect(page.getByTestId(`bar-${T3}`)).toHaveAttribute('data-critical', 'true');
    return;
  }

  await expect(page.getByTestId(`bar-${T1}`)).toHaveAttribute('data-critical', 'true');
  await expect(page.getByTestId('today-line')).toBeAttached();
  const bar = (await page.getByTestId(`bar-${T3}`).locator('rect').boundingBox())!;
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2 - 60, bar.y + bar.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => w.datePatches.length).toBe(1);
  expect(w.datePatches[0].taskId).toBe(T3);
  // Next.js renders its own (empty) route announcer with role="alert", so match the conflict text.
  await expect(page.getByRole('alert').filter({ hasText: 'Pour foundation slab' })).toContainText('"Pour foundation slab" finishes');
});

test('attaching a file PUTs it to the presigned link, then confirms it', async ({ page, context, baseURL }) => {
  const w = await setup(page, context, baseURL!);
  await page.goto(`${tasksUrl}?task=${T1}`);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'Files' })).toBeVisible();
  await drawer.getByLabel('Choose files to attach').setInputFiles({ name: 'site-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello, slab!') });

  await expect.poll(() => w.uploads.confirmed.length).toBe(1);
  expect(w.uploads.requested[0]).toMatchObject({ file_name: 'site-notes.txt', content_type: 'text/plain', size: 12, task_id: T1 });
  expect(w.uploads.put).toEqual([{ contentType: 'text/plain', body: 12 }]);
  expect(w.uploads.confirmed[0]).toMatchObject({ file_name: 'site-notes.txt', task_id: T1 });
  expect(String(w.uploads.confirmed[0].key)).toContain('abc123');
  await expect(drawer.getByText('site-notes.txt')).toBeVisible();
});
