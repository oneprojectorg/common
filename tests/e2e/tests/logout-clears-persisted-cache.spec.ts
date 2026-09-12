import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

/**
 * The app persists successful React Query payloads to `localStorage` with a
 * 24h `gcTime`. Signing out tears down the in-memory cache (it ends in a
 * full-page navigation) but the persisted copy survives the session, so
 * without an explicit erase the next person on a shared browser gets the
 * previous account's data restored and rendered before anything revalidates.
 */
const OFFLINE_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

const readOfflineCache = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), OFFLINE_CACHE_KEY);

test.describe('Sign-out', () => {
  test('erases the persisted query cache and a reload does not restore it', async ({
    page,
  }) => {
    await page.goto('/en/decisions');

    const userMenu = page.getByTestId('user-menu-trigger');
    await expect(userMenu).toBeVisible({ timeout: 20_000 });

    // The persister throttles its writes, so wait for the entry to land
    // rather than assume it is already there.
    await expect
      .poll(async () => (await readOfflineCache(page)) !== null, {
        timeout: 20_000,
      })
      .toBe(true);

    await userMenu.click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    // Sign-out ends in `window.location.assign('/')`, which for a
    // session-less visitor is the public landing page.
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Log in' }),
    ).toBeVisible({ timeout: 20_000 });
    expect(await readOfflineCache(page)).toBeNull();

    // A returning visit must not paint the signed-out account's data: the
    // walled garden sends it to /login and nothing rehydrates behind it.
    await page.goto('/en/decisions');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByTestId('user-menu-trigger')).toHaveCount(0);
    expect(await readOfflineCache(page)).toBeNull();
  });
});
