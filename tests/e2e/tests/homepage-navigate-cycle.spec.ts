import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:3100',
  storageState: '/tmp/playwright_auth.json',
});

test.describe('Homepage navigation cycle - 500 detection', () => {
  test('cycling between homepage and decision pages never shows an error', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const errors: string[] = [];
    let cycle = 0;

    // Helper: check for error state on current page
    const checkForError = async (context: string) => {
      const errorVisible = await page
        .locator('text=Something went wrong on our end')
        .isVisible()
        .catch(() => false);

      const has500 = await page
        .locator('text=Internal Server Error')
        .isVisible()
        .catch(() => false);

      if (errorVisible || has500) {
        const msg = `Cycle #${cycle}: ${context}`;
        errors.push(msg);
        console.error(`❌ ${msg}`);
        await page.screenshot({
          path: `/tmp/error-cycle-${cycle}-${Date.now()}.png`,
        });
        return true;
      }
      return false;
    };

    // Load homepage
    await page.goto('/en/', { waitUntil: 'load' });

    // Verify we're authenticated
    if (page.url().includes('/login') || page.url().includes('/sign-in')) {
      throw new Error('Not authenticated');
    }

    // Wait for Participate links to appear
    await expect(
      page.getByRole('link', { name: 'Participate' }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const totalCycles = 30;

    for (cycle = 1; cycle <= totalCycles; cycle++) {
      // Count available Participate links
      const participateLinks = page.getByRole('link', {
        name: 'Participate',
      });
      const count = await participateLinks.count();

      if (count === 0) {
        console.log(`Cycle #${cycle}: No Participate links found, reloading...`);
        await page.goto('/en/', { waitUntil: 'load' });
        const found = await participateLinks
          .first()
          .isVisible({ timeout: 15_000 })
          .catch(() => false);
        if (!found) {
          await checkForError('homepage has no Participate links');
          await page.goto('/en/', { waitUntil: 'load', timeout: 30_000 });
          await page.waitForTimeout(2000);
          continue;
        }
      }

      const index = (cycle - 1) % Math.max(count, 1);

      // 1. Click Participate
      console.log(`→ Cycle #${cycle}: clicking Participate #${index + 1}`);
      await participateLinks.nth(index).click();
      await page.waitForTimeout(1000);
      if (await checkForError('after clicking Participate')) continue;

      // 2. Click Back (top left)
      const backLink = page.getByRole('link', { name: /Back/ });
      const backVisible = await backLink.isVisible().catch(() => false);
      if (backVisible) {
        console.log(`← Cycle #${cycle}: clicking Back`);
        await backLink.click();
        await page.waitForTimeout(1000);
        if (await checkForError('after clicking Back')) {
          await page.goto('/en/', { waitUntil: 'load' });
          continue;
        }
      } else {
        console.log(`  Cycle #${cycle}: no Back link, going home`);
        await page.goto('/en/', { waitUntil: 'load' });
      }

      // 3. Click Common logo (top left) to go home
      const homeLogo = page
        .getByRole('link')
        .filter({ has: page.locator('img[alt="Common"]') });
      const logoVisible = await homeLogo.first().isVisible().catch(() => false);

      if (logoVisible) {
        console.log(`⌂ Cycle #${cycle}: clicking Common logo`);
        await homeLogo.first().click();
        await page.waitForTimeout(1000);
        if (await checkForError('after clicking Common logo')) {
          await page.goto('/en/', { waitUntil: 'load' });
          continue;
        }
      } else {
        await page.goto('/en/', { waitUntil: 'load' });
      }

      // Wait for homepage to load before next cycle
      await expect(
        page.getByRole('heading', { level: 1, name: /Welcome back/ }),
      ).toBeVisible({ timeout: 15_000 }).catch(() => {});
      await checkForError('homepage after full cycle');

      console.log(`✓ Cycle #${cycle} complete\n`);
    }

    expect(
      errors,
      `Got ${errors.length} / ${totalCycles} errors:\n${errors.join('\n')}`,
    ).toEqual([]);
  });
});
