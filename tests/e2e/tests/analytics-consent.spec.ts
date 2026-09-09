import type { Page } from '@playwright/test';

import {
  ANALYTICS_CONSENT_KEY_PREFIX,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * The shared storage state answers the consent prompt so it doesn't sit over
 * the corner of every other spec. These tests are about the prompt itself, so
 * they start from a visitor who hasn't answered yet.
 */
async function forgetConsentAnswer(page: Page) {
  await page.addInitScript((prefix) => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) {
        window.localStorage.removeItem(key);
      }
    }
  }, ANALYTICS_CONSENT_KEY_PREFIX);
}

const consentToast = (page: Page) =>
  page.getByRole('region', { name: 'Analytics consent' });

test.describe('Analytics consent', () => {
  test.beforeEach(async ({ page }) => {
    await forgetConsentAnswer(page);
  });

  test('keeps asking until the visitor answers, and stays cookieless meanwhile', async ({
    page,
  }) => {
    await page.goto('/en/');
    await expect(consentToast(page)).toBeVisible();

    // Persistent: ignoring it and reloading brings it straight back.
    await page.reload();
    await expect(consentToast(page)).toBeVisible();

    const cookies = await page.context().cookies();
    expect(cookies.filter((cookie) => cookie.name.startsWith('ph_'))).toEqual(
      [],
    );
  });

  test('rejecting dismisses it for good and sets no analytics cookie', async ({
    page,
  }) => {
    await page.goto('/en/');
    await consentToast(page).getByRole('button', { name: 'Reject' }).click();
    await expect(consentToast(page)).toBeHidden();

    await page.reload();
    await expect(consentToast(page)).toBeHidden();

    const cookies = await page.context().cookies();
    expect(cookies.filter((cookie) => cookie.name.startsWith('ph_'))).toEqual(
      [],
    );
  });

  test('accepting dismisses it for good', async ({ page }) => {
    await page.goto('/en/');
    await consentToast(page).getByRole('button', { name: 'Accept' }).click();
    await expect(consentToast(page)).toBeHidden();

    await page.reload();
    await expect(consentToast(page)).toBeHidden();
  });
});
