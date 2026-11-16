import { expect, test } from '@playwright/test';
import { ORG, freshTenant, mockTenantApi, signIn } from './qa-mocks';

// The console shell: the phone project (390 px) gets the shared bottom bar and a drawer instead
// of the sidebar; the desktop project gets the sidebar and no bottom bar.

test('the shell fits the viewport: bottom bar on phones, sidebar on desktop', async ({ page, context, baseURL }, testInfo) => {
  const s = freshTenant({ permissions: [] });
  const user = await signIn(context, baseURL!, s.permissions);
  await mockTenantApi(page, s, user);
  await page.goto(`/${ORG}/dashboard`);

  const bottomNav = page.getByTestId('mobile-bottom-nav').locator('nav');
  const sidebar = page.getByTestId('desktop-sidebar');

  if (testInfo.project.name === 'phone') {
    await expect(bottomNav).toBeVisible();
    await expect(sidebar).toBeHidden();
    // "More" opens the drawer with the full menu.
    await bottomNav.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Dashboard' })).toBeVisible();
    // Nothing on the page scrolls sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  } else {
    await expect(sidebar).toBeVisible();
    await expect(bottomNav).toBeHidden();
    await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  }
});
