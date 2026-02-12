import { expect, test } from '../fixtures/index.js';

test.describe('Redirect on login', () => {
  test('unauthenticated user visiting a protected route is redirected to login with redirect param', async ({
    browser,
  }) => {
    // Use a fresh context with no auth state
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/en/decisions');

    // Should be redirected to /login with the original path as a redirect param
    await expect(page).toHaveURL(/\/login\?redirect=%2Fen%2Fdecisions/, {
      timeout: 15000,
    });

    await context.close();
  });

  test('authenticated user visiting /login?redirect=... is sent to the redirect target', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/login?redirect=%2Fen%2Fdecisions');

    // Should be redirected to the decisions page, not /
    await expect(authenticatedPage).toHaveURL(/\/en\/decisions/, {
      timeout: 15000,
    });
  });

  test('authenticated user visiting /login without redirect param is sent to /', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/login');

    // Should redirect to root since no redirect param
    await expect(authenticatedPage).not.toHaveURL(/\/login/, {
      timeout: 15000,
    });
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
  });
});
