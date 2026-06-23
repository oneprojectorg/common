import { expect, test } from '@playwright/test';

/**
 * Walled-garden boundary: a visitor with no session must get the forbidden
 * screen on any route inside the `(main)` route group (everything outside the
 * public decision views), instead of a 500, a 404, or stuck loading skeletons.
 *
 * These specs use the base Playwright `test` (not the authenticated fixture), so
 * the browser context has no Supabase session.
 */

const WALLED_GARDEN_ROUTES = [
  '/en/decisions',
  '/en/profile/some-user',
  '/en/org',
];

test.describe('Walled garden — unauthenticated access', () => {
  // Belt-and-suspenders: guarantee no auth state even if a global one is added.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of WALLED_GARDEN_ROUTES) {
    test(`${path} renders the forbidden screen for a logged-out visitor`, async ({
      page,
    }) => {
      const response = await page.goto(path);

      // The walled-garden gate responds with a 403 (forbidden() in the layout).
      expect(response?.status()).toBe(403);

      // The reused forbidden screen (PageError, UNAUTHORIZED → 403).
      await expect(
        page.getByText('You do not have permission to view this page'),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole('button', { name: /Go back/i }),
      ).toBeVisible();

      // It must be the forbidden screen — not the generic error screen (which
      // shows a "Try again" button) and not a redirect to login.
      await expect(
        page.getByRole('button', { name: /Try again/i }),
      ).toHaveCount(0);
      await expect(page).not.toHaveURL(/\/login/);
    });
  }
});
