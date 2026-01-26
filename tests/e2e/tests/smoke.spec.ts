import { expect, test } from '../fixtures/index.js';

test.describe('Smoke Tests', () => {
  test('authenticated user sees welcome message on home page', async ({
    authenticatedPage,
  }) => {
    // authenticatedPage is pre-authenticated via storageState
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
