import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ORG, freshTenant, mockTenantApi, signIn } from './qa-mocks';
import { PROJECT_ID } from './work-mocks';
import { SEC_MINE, SEC_REVIEW, TENDER_ID, TENDER_MANAGE, freshTenders, mockTendersApi } from './tenders-mocks';

// Tenders (sprints 1 and 2) at phone (390 px) and desktop widths, every API call mocked.

async function setup(page: Page, context: BrowserContext, baseURL: string, over: Parameters<typeof freshTenders>[0] = {}, permissions = TENDER_MANAGE) {
  const user = await signIn(context, baseURL);
  await mockTenantApi(page, freshTenant({ permissions }), user);
  const s = freshTenders(over);
  await mockTendersApi(page, s);
  return s;
}

const tenderUrl = `/${ORG}/tenders/${TENDER_ID}`;
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name }).filter({ visible: true }).first();

test('the list pages 20 at a time with Show more and searches on the server', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(`/${ORG}/tenders`);
  await expect(page.getByTestId('tender-card')).toHaveCount(20);
  await expect(page.getByText('26 total tenders')).toBeVisible();
  await button(page, 'Show more').click();
  await expect(page.getByTestId('tender-card')).toHaveCount(26);
  await expect(button(page, 'Show more')).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'Search tenders' }).or(page.getByPlaceholder('Search tenders')).first().fill('road');
  await expect(page.getByTestId('tender-card')).toHaveCount(5);
  expect(s.listQueries.some((q) => q.includes('q=road'))).toBe(true);
  // The new statuses have readable tabs.
  await expect(page.getByRole('button', { name: 'Preparing the bid' })).toBeVisible();
});

test('the go/no-go decision scores the criteria and moves the tender to preparing', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!);
  await page.goto(tenderUrl);
  await button(page, 'Go or no go').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('average 72')).toBeVisible();
  for (const label of ['Strategic fit', 'Technical capability', 'Team capacity and timing', 'Value and margin', 'Chance of winning', 'Risk (5 is low risk)']) {
    await dialog.getByRole('radio', { name: `${label} 5`, exact: true }).click();
  }
  await expect(dialog.getByTestId('decision-score')).toContainText('100');
  await expect(dialog.getByTestId('decision-score')).toContainText('Recommendation: Go');
  // Going against the recommendation needs a comment.
  await dialog.getByText('No go', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Record decision' }).click();
  await expect(dialog.getByRole('alert')).toContainText('differs from the recommendation');
  await dialog.getByText('Go, prepare the bid').click();
  await dialog.getByRole('button', { name: 'Record decision' }).click();
  await expect.poll(() => s.decisions.length).toBe(1);
  expect(s.decisions[0]).toMatchObject({ decision: 'go', threshold: 65, comment: '' });
  expect((s.decisions[0].criteria as { score: number }[]).every((c) => c.score === 5)).toBe(true);
  await expect(page.getByTestId('go-decision')).toContainText('Go on a weighted score of');
});

test('a reviewer approves a section and asks for changes with a comment; the assignee sends theirs for review', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { status: 'preparing' });
  await page.goto(`${tenderUrl}/sections`);
  await expect(page.getByText('Technical proposal').filter({ visible: true }).first()).toBeVisible();
  // My own section: I can send it for review but not review it.
  await button(page, 'Send Financial proposal for review').click();
  await expect.poll(() => s.reviews.find((x) => x.id === SEC_MINE)?.action).toBe('submit');
  await expect(page.getByRole('button', { name: 'Approve Financial proposal' })).toHaveCount(0);

  await button(page, 'Ask for changes on Technical proposal').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Change request comment').fill('Add the network diagram');
  await dialog.getByRole('button', { name: 'Send back' }).click();
  await expect.poll(() => s.reviews.find((x) => x.id === SEC_REVIEW)).toEqual({ id: SEC_REVIEW, action: 'request-changes', body: { comment: 'Add the network diagram' } });
});

test('a section in review is approved', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { status: 'preparing' });
  await page.goto(`${tenderUrl}/sections`);
  await button(page, 'Approve Technical proposal').click();
  await expect.poll(() => s.reviews.map((x) => `${x.id}:${x.action}`)).toContain(`${SEC_REVIEW}:approve`);
});

test('the bid is submitted by email once the sections are approved or overridden', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { status: 'preparing' });
  await page.goto(`${tenderUrl}/submissions`);
  await page.getByLabel('Recipient').fill('tenders@health.go.ke');
  await page.getByLabel('Reference').fill('MSG-77');
  await button(page, 'Record submission').click();
  // Next.js keeps an empty route announcer with role alert, so pick the form's alert by its text.
  await expect(page.getByRole('alert').filter({ hasText: 'sections are approved' })).toContainText('0 of 2 sections are approved');
  await page.getByText('Submit although not every section is approved').click();
  await button(page, 'Record submission').click();
  await expect.poll(() => s.submissionPosts.length).toBe(1);
  expect(s.submissionPosts[0]).toMatchObject({ method: 'email', recipient: 'tenders@health.go.ke', reference: 'MSG-77', override_sections: true });
  await expect(page.getByTestId('submission')).toContainText('To tenders@health.go.ke');
});

test('the outcome is recorded as won with the award value', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { status: 'submitted' });
  await page.goto(tenderUrl);
  await button(page, 'Record the outcome').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Contract reference').fill('MOH/ICT/2026/4');
  await dialog.getByRole('button', { name: 'Save outcome' }).click();
  await expect.poll(() => s.outcomes.length).toBe(1);
  expect(s.outcomes[0]).toMatchObject({ outcome: 'won', award_value: 5000000, contract_reference: 'MOH/ICT/2026/4' });
});

test('a loss needs its reason', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { status: 'under_review' });
  await page.goto(tenderUrl);
  await button(page, 'Record the outcome').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'We lost' }).click();
  await dialog.getByRole('button', { name: 'Save outcome' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Say why');
  await dialog.getByLabel('Why we lost').fill('Price');
  await dialog.getByRole('button', { name: 'Save outcome' }).click();
  await expect.poll(() => s.outcomes[0]).toMatchObject({ outcome: 'lost', loss_reason: 'Price' });
});

test('a won tender converts into a project and opens it', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, {
    status: 'awarded',
    tender: { metadata: { crm_contact_id: 'c0ffee00-0000-4000-8000-000000000001', crm_contact_name: 'Ministry of Health', bid_budget: { lines: [{ name: 'Switches', planned_amount: '1200000' }] }, outcome: { outcome: 'won', award_value: 4800000, contract_start: '2027-01-04', contract_end: '2027-06-30', recorded_at: '2026-11-16T08:00:00Z' } } },
  });
  await page.goto(tenderUrl);
  await button(page, 'Convert to a project').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Contract value')).toHaveValue('4800000');
  await expect(dialog.getByLabel('Project start')).toHaveValue('2027-01-04');
  await expect(dialog.getByText('Create a draft project budget in treasury from the bid budget')).toBeVisible();
  await dialog.getByRole('button', { name: 'Create the project' }).click();
  await expect.poll(() => s.converts.length).toBe(1);
  expect(s.converts[0]).toMatchObject({ name: 'Hospital ICT network', billing_type: 'fixed', contract_value: 4800000, start_date: '2027-01-04', end_date: '2027-06-30' });
  expect(s.converts[0].skip_budget).toBeUndefined();
  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}$`));
});

test('a converted tender links its project and retries a failed treasury budget', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, {
    status: 'awarded',
    tender: {
      metadata: {
        outcome: { outcome: 'won', award_value: 4800000, recorded_at: '2026-11-16T08:00:00Z' },
        conversion: { project_id: PROJECT_ID, project_name: 'Hospital ICT network', converted_at: '2026-11-16T09:00:00Z', converted_by: 'x', members_added: 2, documents_linked: 1, budget: { status: 'failed', attempts: 1, error: 'fiscal year closed' } },
      },
    },
  });
  await page.goto(tenderUrl);
  const card = page.getByTestId('conversion-card');
  await expect(card.getByRole('link', { name: 'Hospital ICT network' })).toHaveAttribute('href', `/${ORG}/projects/${PROJECT_ID}`);
  await expect(card).toContainText('fiscal year closed');
  await expect(page.getByRole('button', { name: 'Convert to a project' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Send to treasury again' }).click();
  await expect.poll(() => s.pushes).toBe(1);
});

test('a viewer sees the tender without the lifecycle actions', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { status: 'evaluating' }, ['projects.tenders.view']);
  await page.goto(tenderUrl);
  await expect(page.getByRole('heading', { name: 'Hospital ICT network' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go or no go' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start evaluating' })).toHaveCount(0);
});

test('a status from before the current vocabulary shows as draft and never breaks the page', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, { status: 'bidding' });
  await page.goto(tenderUrl);
  await expect(page.getByRole('heading', { name: 'Hospital ICT network' })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
});

test('the bid budget is edited and saved as metadata, and locks once converted', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { status: 'preparing' });
  await page.goto(tenderUrl);
  const card = page.getByTestId('bid-budget');
  await expect(card.getByTestId('bid-total')).toContainText('1,200,000');
  await card.getByRole('button', { name: 'Edit' }).click();
  await card.getByLabel('Line 1 amount').fill('1250000.50');
  await card.getByRole('button', { name: 'Add line' }).click();
  await card.getByLabel('Line 2 name').fill('Installation labour');
  await card.getByLabel('Line 2 amount').fill('1.234');
  await card.getByRole('button', { name: 'Save bid budget' }).click();
  await expect(card.getByRole('alert')).toContainText('Line 2');
  await card.getByLabel('Line 2 amount').fill('300000');
  await card.getByLabel('Line 2 notes').fill('Two technicians, six weeks');
  await card.getByRole('button', { name: 'Save bid budget' }).click();
  await expect.poll(() => s.puts.length).toBe(1);
  expect(s.puts[0]).toEqual({
    metadata: {
      bid_budget: {
        lines: [
          { name: 'Switches', category: 'expense', planned_amount: '1250000.50' },
          { name: 'Installation labour', category: 'expense', planned_amount: '300000', notes: 'Two technicians, six weeks' },
        ],
      },
    },
  });
  await expect(card.getByTestId('bid-total')).toContainText('1,550,000.5');
});

test('removing every bid budget line removes the budget', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { status: 'preparing' });
  await page.goto(tenderUrl);
  const card = page.getByTestId('bid-budget');
  await card.getByRole('button', { name: 'Edit' }).click();
  await card.getByRole('button', { name: 'Remove line 1' }).click();
  await card.getByRole('button', { name: 'Save bid budget' }).click();
  await expect.poll(() => s.puts[0]).toEqual({ metadata: { bid_budget: null } });
});

test('the tender details are edited with only the changed fields sent', async ({ page, context, baseURL }) => {
  const s = await setup(page, context, baseURL!, { status: 'evaluating' });
  await page.goto(tenderUrl);
  await button(page, 'Edit details').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Source').fill('PPIP portal');
  await dialog.getByLabel('Deadline').fill('2026-12-20');
  await dialog.getByLabel('New tag').fill('ICT');
  await dialog.getByLabel('New tag').press('Enter');
  await dialog.getByRole('button', { name: 'Save tender' }).click();
  await expect.poll(() => s.puts.length).toBe(1);
  expect(s.puts[0]).toEqual({ source: 'PPIP portal', deadline: '2026-12-20', metadata: { tags: ['ICT'] } });
});

test('a converted tender says its budget lives in treasury and offers no edit', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, {
    status: 'awarded',
    tender: {
      metadata: {
        bid_budget: { lines: [{ name: 'Switches', category: 'expense', planned_amount: '1200000' }] },
        conversion: { project_id: PROJECT_ID, project_name: 'Hospital ICT network', converted_at: '2026-11-16T09:00:00Z', converted_by: 'x', members_added: 0, documents_linked: 0, budget: { status: 'created' } },
      },
    },
  });
  await page.goto(tenderUrl);
  const card = page.getByTestId('bid-budget');
  await expect(card).toContainText('its budget lives in treasury');
  await expect(card.getByRole('button', { name: 'Edit' })).toHaveCount(0);
});
