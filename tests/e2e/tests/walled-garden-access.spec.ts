import { expect, test } from '@playwright/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createSupabaseAdminClient,
  createUser,
} from '../fixtures/index.js';

/**
 * Walled-garden boundary: routes inside the `(main)` route group (everything
 * outside the public decision views) gate two ways —
 * - no session (or anonymous) → redirected to /login, since logging in can grant access;
 * - a real account that isn't a network member → the forbidden screen, since it can't.
 */

const WALLED_GARDEN_ROUTES = [
  '/en/decisions',
  '/en/profile/some-user',
  '/en/org',
];

test.describe('Walled garden — logged-out visitors', () => {
  // Base Playwright test (no authenticated fixture) → no Supabase session.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of WALLED_GARDEN_ROUTES) {
    test(`${path} redirects to /login`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });
  }
});

test.describe('Walled garden — authenticated non-members', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();
  // A real, confirmed account on a non-network domain with no allow-list entry.
  const email = `wg-nonmember-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  let userId: string | undefined;

  test.beforeAll(async () => {
    const user = await createUser({ supabaseAdmin: admin, email });
    userId = user.id;
  });

  test.afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  test('see the forbidden screen, not a login redirect', async ({ page }) => {
    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    const response = await page.goto('/en/decisions');

    expect(response?.status()).toBe(403);
    await expect(
      page.getByText('You do not have permission to view this page'),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Go back/i })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });
});
