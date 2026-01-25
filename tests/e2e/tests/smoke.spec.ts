import { expect, test } from '../fixtures/index.js';

test.describe('Smoke Tests', () => {
  test('authenticated user sees welcome message on home page', async ({
    authenticatedPage,
  }) => {
    // authenticatedPage already logged in via UI, now navigate to home
    // Navigate directly to /en/ to bypass middleware auth check (which can't read our test session)
    await authenticatedPage.goto('/en/');

    // Verify we're not redirected to login
    await expect(authenticatedPage).not.toHaveURL(/\/login/);

    // Verify the welcome heading is visible (indicates successful auth + home page render)
    // Using getByRole instead of getByTestId since Header1 doesn't pass through data-testid
    await expect(
      authenticatedPage.getByRole('heading', {
        level: 1,
        name: /Welcome back/,
      }),
    ).toBeVisible({
      timeout: 15000,
    });
  });
});
