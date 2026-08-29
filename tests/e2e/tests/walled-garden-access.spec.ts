import { expect, test } from '@playwright/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAnonymously,
  authenticateAsUser,
  createSupabaseAdminClient,
  createUser,
} from '../fixtures/index.js';

/**
 * Walled-garden boundary: routes inside the `(main)` route group (everything
 * outside the public decision views) gate two ways —
 * - no session (or anonymous) → redirected to /login, since logging in can grant access;
 * - a real account that isn't a network member → the forbidden screen, since it can't.
 *
 * The public decision views in `(no-header)` have no layout gate at all, so a
 * logged-out visitor renders the page and its member-only queries 401 instead —
 * covered by the "Legacy decision route" describe.
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
    test(`${path} redirects to /login preserving the path`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 15000 });
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(path);
    });
  }

  // Anonymous visit to a path with no locale prefix — the i18n proxy must add
  // the locale before the walled-garden gate redirects to /login. Regression
  // for the `user &&` guard that previously skipped locale handling for
  // logged-out users.
  test('/decisions (no locale) gets the locale prefix before /login redirect', async ({
    page,
  }) => {
    await page.goto('/decisions');

    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 15000 });
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(
      '/en/decisions',
    );
  });
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

test.describe('Legacy decision route — logged-out visitors', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // Regression: this route is in `(no-header)`, so no layout gate intercepts a
  // logged-out visitor — the page renders and `decision.getLegacyInstance`
  // answers 401. That status was missing from ResourceErrorBoundary's interrupt
  // table, so the boundary rethrew and error.tsx rendered the generic 500
  // screen ("Something went wrong on our end") instead of the no-access one.
  test('see the forbidden screen, not the generic 500', async ({ page }) => {
    // The procedure's network-auth gate rejects before input parsing, so the
    // instance id never has to resolve for the 401 to be the first failure.
    await page.goto(
      '/en/profile/one-project/decisions/00000000-0000-4000-8000-000000000000',
    );

    await expect(
      page.getByText('You do not have permission to view this page'),
    ).toBeVisible({ timeout: 15000 });
    // Not redundant: PageError renders this same copy for its UNAUTHORIZED
    // branch, so the forbidden text alone doesn't prove error.tsx stayed out
    // of it. The 500 heading is what distinguishes the two screens.
    await expect(page.getByText('Something went wrong on our end')).toHaveCount(
      0,
    );
  });
});

test.describe('Walled garden — anonymous sessions can log in', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // Regression: an anonymous session is "signed in" to Supabase but not a
  // member. The gate sends it to /login; /login must show the panel rather than
  // bouncing it back into the app (which previously caused an infinite loop).
  test('/login shows the panel for an anonymous visitor (no redirect loop)', async ({
    page,
  }) => {
    await authenticateAnonymously(page);

    await page.goto('/login');

    await expect(page.getByLabel('Email', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/login/);
  });
});
