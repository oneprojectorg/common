import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

const OFFLINE_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

const readOfflineCache = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), OFFLINE_CACHE_KEY);

test.describe('Sign-out', () => {
  test('erases the persisted account and a late write does not restore it', async ({
    page,
    workerAuthUser,
  }) => {
    await page.goto('/en/decisions');

    const userMenu = page.getByTestId('user-menu-trigger');
    await expect(userMenu).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => (await readOfflineCache(page)) ?? '', {
        timeout: 20_000,
      })
      .toContain(workerAuthUser.email);

    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        await route.continue();
      },
    );

    await userMenu.click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Log in' }),
    ).toBeVisible({ timeout: 20_000 });
    expect((await readOfflineCache(page)) ?? '').not.toContain(
      workerAuthUser.email,
    );

    await page.goto('/en/decisions');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByTestId('user-menu-trigger')).toHaveCount(0);
    expect((await readOfflineCache(page)) ?? '').not.toContain(
      workerAuthUser.email,
    );
  });
});
