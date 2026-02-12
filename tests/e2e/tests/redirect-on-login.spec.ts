import { expect, test } from '../fixtures/index.js';

test.describe('Redirect on login', () => {
  test('authenticated user visiting /login?redirect=... is sent to the redirect target', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/login?redirect=%2Fen%2Fdecisions');

    // Should be redirected to the decisions page, not /
    await expect(authenticatedPage).toHaveURL(/\/en\/decisions/, {
      timeout: 15000,
    });

    // Page should not be an error
    await expect(authenticatedPage.locator('text=500')).not.toBeVisible();
  });

  test('authenticated user visiting /login without redirect param is sent to /', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/login');

    // Should redirect to root since no redirect param
    await expect(authenticatedPage).not.toHaveURL(/\/login/, {
      timeout: 15000,
    });

    // Should land on a working page, not an error
    await expect(
      authenticatedPage.getByRole('heading', {
        level: 1,
        name: /Welcome back/,
      }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('redirect param of /login does not cause an infinite loop', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/login?redirect=%2Flogin');

    // Should NOT stay on /login — must break the loop and land on /
    await expect(authenticatedPage).not.toHaveURL(/\/login/, {
      timeout: 15000,
    });

    // Should land on a working page, not an error
    await expect(
      authenticatedPage.getByRole('heading', {
        level: 1,
        name: /Welcome back/,
      }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('redirect param of locale-prefixed /login does not cause an infinite loop', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/login?redirect=%2Fen%2Flogin');

    // Should NOT redirect to /en/login
    await expect(authenticatedPage).not.toHaveURL(/\/login/, {
      timeout: 15000,
    });

    // Should land on a working page, not an error
    await expect(
      authenticatedPage.getByRole('heading', {
        level: 1,
        name: /Welcome back/,
      }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('redirect param of /api/ path is rejected', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/login?redirect=%2Fapi%2Fauth%2Fcallback');

    // Should NOT redirect to /api/auth/callback
    await expect(authenticatedPage).not.toHaveURL(/\/api\//, {
      timeout: 15000,
    });
    await expect(authenticatedPage).not.toHaveURL(/\/login/, {
      timeout: 15000,
    });

    // Should land on a working page, not an error
    await expect(
      authenticatedPage.getByRole('heading', {
        level: 1,
        name: /Welcome back/,
      }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('redirect param with protocol-relative URL is rejected', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/login?redirect=%2F%2Fevil.com');

    // Should NOT redirect to //evil.com, should go to / instead
    await expect(authenticatedPage).not.toHaveURL(/evil\.com/, {
      timeout: 15000,
    });
    await expect(authenticatedPage).not.toHaveURL(/\/login/, {
      timeout: 15000,
    });

    // Should land on a working page, not an error
    await expect(
      authenticatedPage.getByRole('heading', {
        level: 1,
        name: /Welcome back/,
      }),
    ).toBeVisible({ timeout: 15000 });
  });
});
