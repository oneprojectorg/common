import type { Page } from '@playwright/test';

import {
  ANALYTICS_CONSENT_KEY_PREFIX,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Land on the app as a visitor who hasn't answered the consent prompt. The
 * shared storage state answers it so it isn't sitting over the corner of every
 * other spec; these tests are about the prompt itself.
 *
 * The answer is cleared once and the page reloaded, rather than through an init
 * script — an init script re-runs on every navigation, which would also wipe
 * the answer the visitor gives partway through a test.
 */
async function visitAsUnansweredVisitor(page: Page) {
  await page.goto('/en/');
  await page.evaluate((prefix) => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) {
        window.localStorage.removeItem(key);
      }
    }
  }, ANALYTICS_CONSENT_KEY_PREFIX);
  await page.reload();
}

const cookieBanner = (page: Page) =>
  page.getByRole('region', { name: 'Your Privacy' });

const analyticsCookies = async (page: Page) =>
  (await page.context().cookies()).filter((cookie) =>
    cookie.name.startsWith('ph_'),
  );

test.describe('Analytics consent', () => {
  test('keeps asking until the visitor answers, and stays cookieless meanwhile', async ({
    page,
  }) => {
    await visitAsUnansweredVisitor(page);
    await expect(cookieBanner(page)).toBeVisible();

    // Persistent: ignoring it and reloading brings it straight back.
    await page.reload();
    await expect(cookieBanner(page)).toBeVisible();

    expect(await analyticsCookies(page)).toEqual([]);
  });

  test('rejecting dismisses it for good and sets no analytics cookie', async ({
    page,
  }) => {
    await visitAsUnansweredVisitor(page);
    await cookieBanner(page).getByRole('button', { name: 'Reject' }).click();
    await expect(cookieBanner(page)).toBeHidden();

    await page.reload();
    await expect(cookieBanner(page)).toBeHidden();

    expect(await analyticsCookies(page)).toEqual([]);
  });

  test('accepting dismisses it for good', async ({ page }) => {
    await visitAsUnansweredVisitor(page);
    await cookieBanner(page).getByRole('button', { name: 'Accept' }).click();
    await expect(cookieBanner(page)).toBeHidden();

    await page.reload();
    await expect(cookieBanner(page)).toBeHidden();
  });

  // The policy pages live outside the `[locale]` segment, which is what keeps
  // them out of the walled garden. A locale-prefixed href would send someone
  // reading a cookie banner to /login to read the privacy policy.
  test('links to the policies outside the locale segment, in a new tab', async ({
    page,
  }) => {
    await visitAsUnansweredVisitor(page);
    const banner = cookieBanner(page);

    const policies = [
      { name: 'Privacy Policy', href: '/info/privacy' },
      { name: 'Terms of Use', href: '/info/tos' },
    ];

    for (const policy of policies) {
      // The accessible name carries a trailing "(opens in a new tab)".
      const link = banner.getByRole('link', {
        name: new RegExp(`^${policy.name}`),
      });
      await expect(link).toHaveAttribute('href', policy.href);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  // Vercel's edge sets this header and overwrites anything the client sent, so
  // it can't be spoofed where it counts. Here it's the only way to stand in a
  // country from a local browser.
  test('never asks a US visitor', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-vercel-ip-country': 'US' });
    await visitAsUnansweredVisitor(page);

    await expect(cookieBanner(page)).toBeHidden();
  });
});
