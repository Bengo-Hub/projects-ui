import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ORG, freshTenant, mockTenantApi, signIn } from './qa-mocks';
import { PROJECT_ID, T1, WORK_PERMISSIONS, freshWork, mockWorkApi } from './work-mocks';
import { TIME_PERMISSIONS, freshTime, mockTimeApi } from './time-mocks';
import { dayName, mondayOf, todayIn, weekDays } from '../src/lib/work/time';

// Sprint 13 time screens at phone (390 px) and desktop widths, every API call mocked. The browser
// runs in Nairobi so the page's week and the mocks agree on dates.

const TZ = 'Africa/Nairobi';
test.use({ timezoneId: TZ });

const days = () => weekDays(mondayOf(todayIn(TZ)));

async function setup(page: Page, context: BrowserContext, baseURL: string) {
  const s = freshTenant({ permissions: [...WORK_PERMISSIONS, ...TIME_PERMISSIONS] });
  const user = await signIn(context, baseURL);
  await mockTenantApi(page, s, user);
  await mockWorkApi(page, freshWork());
  const t = freshTime(days()[0]);
  await mockTimeApi(page, t);
  return t;
}

const isPhone = (page: Page) => page.viewportSize()!.width < 768;

test('a timer started on a card shows in the header, survives a reload and stops with the browser times', async ({ page, context, baseURL }) => {
  const t = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/projects/${PROJECT_ID}/tasks`);
  await page.getByTestId('column-todo').getByRole('button', { name: /^Start a timer on Pour foundation slab/ }).click();
  const pill = page.getByTestId('timer-pill');
  await expect(pill).toBeVisible();
  await expect(pill).toContainText(/5:\d\d/);
  expect(t.starts).toEqual([T1]);

  // The server is the source of truth: a reload reads the running timer back.
  await page.reload();
  await expect(page.getByTestId('timer-pill')).toBeVisible();

  const started = t.timer!.started_at;
  await page.getByTestId('timer-pill').getByRole('button', { name: 'Stop the timer on Pour foundation slab' }).click();
  await expect(page.getByTestId('timer-pill')).toHaveCount(0);
  await expect.poll(() => t.stops.length).toBe(1);
  expect(t.stops[0]).toMatchObject({ project_id: PROJECT_ID, task_id: T1, started_at: started });
  expect(Date.parse(String(t.stops[0].stopped_at))).toBeGreaterThan(Date.parse(started));
});

test('the week grid saves a cell, recounts the totals and submits after a confirm', async ({ page, context, baseURL }) => {
  const t = await setup(page, context, baseURL!);
  const monday = days()[0];
  await page.goto(`/${ORG}/time`);
  await expect(page.getByTestId('week-status')).toHaveText('Draft');

  if (isPhone(page)) {
    await expect(page.getByTestId('day-list')).toBeVisible();
    await page.getByRole('tab', { name: new RegExp(`^${dayName(monday, true)}`) }).click();
  } else {
    await expect(page.getByTestId('week-grid')).toBeVisible();
  }
  const cell = page.getByRole('textbox', { name: `Riverside clinic fit-out, Pour foundation slab on ${dayName(monday, true)}` });
  await expect(cell).toHaveValue('2');
  await cell.fill('3.5');
  await cell.press('Enter');

  await expect.poll(() => t.puts.length).toBe(1);
  expect(t.puts[0]).toMatchObject({ project_id: PROJECT_ID, task_id: T1, date: monday, hours: 3.5, billable: true });
  await expect(page.getByTestId(isPhone(page) ? 'week-total-phone' : 'week-total')).toContainText('4.5');

  await page.getByRole('button', { name: 'Submit week' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('4.5 hours');
  await dialog.getByRole('button', { name: 'Submit week' }).click();
  await expect.poll(() => t.submits.length).toBe(1);
  expect(t.submits[0]).toMatchObject({ week_start: monday });
  await expect(page.getByTestId('week-status')).toHaveText('Submitted');
  // A submitted week is read only and cannot be submitted again.
  await expect(page.getByRole('textbox', { name: /Pour foundation slab on/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit week' })).toHaveCount(0);
});

test('a user without an ERP employee record gets a clear empty state, not a toast loop', async ({ page, context, baseURL }) => {
  const t = await setup(page, context, baseURL!);
  t.noEmployee = true;
  await page.goto(`/${ORG}/time`);
  await expect(page.getByText('Your account has no employee record in ERP. Ask HR to link it.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No employee record' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit week' })).toHaveCount(0);
});

test('the billable switch shows on time and materials rows only and re-sends the logged days', async ({ page, context, baseURL }) => {
  const t = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/time`);
  await expect(page.getByText('Head office refit').first()).toBeVisible();
  // One switch: the fixed fee project's row has none.
  const switches = page.getByRole('switch', { name: 'Billable' });
  await expect(switches).toHaveCount(1);
  await expect(page.getByTestId(`row-${'99999999-9999-4999-8999-999999999999'}:`).getByRole('switch')).toHaveCount(0);

  await switches.first().click();
  await expect.poll(() => t.puts.length).toBe(1);
  expect(t.puts[0]).toMatchObject({ project_id: PROJECT_ID, task_id: T1, date: days()[0], hours: 2, billable: false });
});

test('the timer starts from a My Work row without opening the task', async ({ page, context, baseURL }) => {
  const t = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/my-work`);
  await page.getByTestId('bucket-overdue').getByRole('button', { name: /^Start a timer on Pour foundation slab/ }).click();
  await expect(page.getByTestId('timer-pill')).toBeVisible();
  expect(t.starts).toEqual([T1]);
  await expect(page).not.toHaveURL(/task=/);
});
