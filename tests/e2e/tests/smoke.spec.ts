import { expect, test } from '../fixtures/index.js';

test.describe('Smoke Tests', () => {
  test('login page shows sign in form for unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/login');

    // Wait for the login panel to load
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 10000 });

    // Check for email input
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();

    // Check for sign in button
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Check for Google OAuth option
    await expect(
      page.getByRole('button', { name: /continue with google/i }),
    ).toBeVisible();
  });

  test('authenticated user can access the home page', async ({
    authenticatedPage,
  }) => {
    // authenticatedPage already logged in via UI, now navigate
    await authenticatedPage.goto('/');

    // An authenticated user should not be redirected to login
    await expect(authenticatedPage).not.toHaveURL(/\/login/);
  });
});
