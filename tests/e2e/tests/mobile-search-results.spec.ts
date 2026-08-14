import type { Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * The mobile search sheet is full height, and the results list has to fill it
 * rather than stop at the `max-h-72` `CommandList` ships. Measured, not asserted
 * on classes, because `max-h-none` clears that cap silently-not-at-all.
 */

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Mobile search results fill the screen', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('the results list fills the sheet instead of stopping at its own cap', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `search-height-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 3 },
    });
    await authenticateAsUser(page, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    await page.goto('/en/', { waitUntil: 'domcontentloaded' });

    // Below `md` the header collapses search behind an icon.
    await page.getByRole('button', { name: 'Search' }).first().click();
    await page
      .getByRole('combobox', { name: 'Search' })
      .fill(org.organizationProfile.name.slice(0, 4));

    const panel = page.getByLabel('Search results');
    await expect(panel).toBeVisible();

    const list = page.locator('[data-slot="command-list"]');
    await expect(list).toBeVisible();

    const panelBox = await boundingBox(panel);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(panelBox.x).toBe(0);
    expect(panelBox.y + panelBox.height).toBe(viewportHeight);

    // Slack is the sheet's bottom padding; the number to beat is `max-h-72`'s 288px.
    const listHeight = await list.evaluate((element) => element.clientHeight);
    expect(listHeight).toBeGreaterThan(panelBox.height - 64);
  });
});

async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element is not rendered, so its geometry cannot be read.');
  }
  return box;
}
