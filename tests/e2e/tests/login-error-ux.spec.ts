import { expect, test } from '../fixtures/index.js';

// LoginPanel only renders for unauthed users; the worker-scoped fixture in
// auth.ts auto-authenticates the default `page`, so opt out for this describe.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login error UX', () => {
  test('renders waitlist UI for not_invited code', async ({ page }) => {
    await page.goto('/login?error=not_invited');

    await expect(
      page.getByRole('heading', { level: 1, name: /Stay tuned/ }),
    ).toBeVisible();
    await expect(page.getByText(/invite-only/i)).toBeVisible();
    await expect(page.getByText(/waitlist/i)).toBeVisible();
  });

  test('renders Oops UI with cancelled copy for oauth_cancelled', async ({
    page,
  }) => {
    await page.goto('/login?error=oauth_cancelled');

    await expect(
      page.getByRole('heading', { level: 1, name: /Oops/ }),
    ).toBeVisible();
    await expect(page.getByText(/cancelled/i)).toBeVisible();
  });

  test('renders Oops UI with provider copy for oauth_failed', async ({
    page,
  }) => {
    await page.goto('/login?error=oauth_failed');

    await expect(
      page.getByRole('heading', { level: 1, name: /Oops/ }),
    ).toBeVisible();
    await expect(page.getByText(/sign-in with your provider/i)).toBeVisible();
  });

  test('falls back to generic copy for unrecognized error codes', async ({
    page,
  }) => {
    await page.goto('/login?error=totally_made_up_code');

    await expect(
      page.getByRole('heading', { level: 1, name: /Oops/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/There was an error signing you in/i),
    ).toBeVisible();
  });

  test('surfaces error_description as a sub-message when present', async ({
    page,
  }) => {
    const description = 'The provider returned a custom failure detail.';
    await page.goto(
      `/login?error=oauth_failed&error_description=${encodeURIComponent(description)}`,
    );

    await expect(page.getByText(/sign-in with your provider/i)).toBeVisible();
    await expect(page.getByText(description)).toBeVisible();
  });

  test('hash handler routes Supabase OAuth-error fragment to /login', async ({
    page,
  }) => {
    await page.goto(
      '/#error=access_denied&error_description=User+denied+the+request&sb=',
    );

    await expect(page).toHaveURL(/\/login\?error=oauth_cancelled/, {
      timeout: 10000,
    });
    await expect(
      page.getByRole('heading', { level: 1, name: /Oops/ }),
    ).toBeVisible();
    await expect(page.getByText(/cancelled/i)).toBeVisible();
  });

  test('hash handler ignores fragments without the Supabase sb marker', async ({
    page,
  }) => {
    await page.goto('/#error=something&error_description=anchor+collision');

    // No redirect — we should stay on / (homepage / landing)
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('hash handler ignores plain in-page anchor links', async ({ page }) => {
    await page.goto('/#section-2');

    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
