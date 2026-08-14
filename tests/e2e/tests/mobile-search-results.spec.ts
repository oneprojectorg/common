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
 * On mobile the header search opens a full-height sheet, and the results list
 * has to fill it. The list is a `CommandList`, which ships a `max-h-72`
 * default — so this asserts the measured height, not the classes. Two ways it
 * has regressed before:
 *
 * - The cap wins and the results sit in the top third of an otherwise empty
 *   white screen.
 * - `max-h-none` is used to clear the cap, which silently does nothing:
 *   tailwind-merge 3.4 leaves `none` out of its `max-h` group (unlike
 *   `max-w`), so the class merges in alongside `max-h-72` instead of
 *   displacing it.
 */

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Mobile search results fill the screen', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('the results list fills the sheet instead of stopping at its own cap', async ({
    page,
  }) => {
    // Members give the search enough profiles to overflow a phone screen.
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

    // The sheet covers everything below the header.
    expect(panelBox.x).toBe(0);
    expect(panelBox.y + panelBox.height).toBe(viewportHeight);

    // And the list fills the sheet rather than stopping at its own cap. The
    // slack is the sheet's bottom padding; the number to beat is the 288px
    // `max-h-72` this used to collapse to. Deliberately not asserting that the
    // list overflows — that depends on how many profiles happen to match, and
    // the height cap is the regression worth pinning.
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
