import { expect, test } from '../fixtures/index.js';

test.describe('Login subpath 404', () => {
  test('/login/foo renders 404 page, not 500', async ({
    authenticatedPage,
  }) => {
    const response = await authenticatedPage.goto('/login/foo');

    expect(response?.status()).toBe(404);

    await expect(authenticatedPage.getByText('404')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      authenticatedPage.getByText("Oops! We can't find that page."),
    ).toBeVisible();
  });

  test('/login/bar/baz renders 404 page for deeply nested path', async ({
    authenticatedPage,
  }) => {
    const response = await authenticatedPage.goto('/login/bar/baz');

    expect(response?.status()).toBe(404);

    await expect(authenticatedPage.getByText('404')).toBeVisible({
      timeout: 10000,
    });
  });
});
