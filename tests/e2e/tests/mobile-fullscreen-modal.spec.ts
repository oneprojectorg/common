import { users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  getSeededTemplate,
  makeDecisionPublic,
} from '@op/test';
import type { Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Below `sm` a `Dialog` covers the viewport with its header and footer pinned.
 * Geometry is the contract, so it's measured rather than asserted on classes:
 * short content pins the footer via `mt-auto`, tall content via `sticky`.
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.use({ viewport: MOBILE_VIEWPORT });

test.describe('Modals on mobile are full screen', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('a short modal fills the viewport with its footer at the bottom of the screen', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `fullscreen-short-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });
    // Public is what makes the header offer Join to a no-session visitor.
    await makeDecisionPublic({ profileId: instance.profileId });

    await page.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: 'Join' }).click();

    const dialog = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(
      dialog.getByRole('heading', { name: 'Claim your account' }),
    ).toBeVisible({ timeout: 15000 });

    await expectFillsViewport(dialog);
    await expectHeaderAtTopOfScreen(dialog);
    await expectFooterAtBottomOfScreen(dialog);
  });

  test('a modal with a scrolling body keeps its header at the top of the screen', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `fullscreen-tall-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });

    // Clearing acceptance opens the re-acceptance gate on first page load.
    await db
      .update(users)
      .set({ tosAcceptedOn: null, privacyAcceptedOn: null })
      .where(eq(users.authUserId, org.adminUser.authUserId));

    await authenticateAsUser(page, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    await page.goto('/en/', { waitUntil: 'domcontentloaded' });

    const dialogs = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    const gate = dialogs.filter({ hasText: "We've updated our policies." });
    await expect(
      gate.getByRole('heading', { name: "We've updated our policies." }),
    ).toBeVisible({ timeout: 20000 });

    await expectFillsViewport(gate);
    await expectHeaderAtTopOfScreen(gate);
    await expectFooterAtBottomOfScreen(gate);

    // The gate's body is short; the document it stacks on top is not.
    await gate.getByRole('button', { name: 'Terms of Use' }).click();
    const doc = dialogs.filter({
      hasText: 'TERMS OF SERVICE FOR COMMON PLATFORM',
    });
    await expect(
      doc.getByRole('heading', {
        name: /TERMS OF SERVICE FOR COMMON PLATFORM/,
      }),
    ).toBeVisible({ timeout: 15000 });

    await expectFillsViewport(doc);
    await expectHeaderAtTopOfScreen(doc);

    const body = doc.locator('[data-slot="dialog-header"] ~ div').first();
    await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    // Non-zero scrollTop proves the body actually overflowed.
    await expect
      .poll(() => body.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    await expectHeaderAtTopOfScreen(doc);
  });
});

async function expectFillsViewport(dialog: Locator) {
  const box = await boundingBox(dialog);
  const viewport = await viewportSize(dialog.page());
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(box.width).toBe(viewport.width);
  expect(box.height).toBe(viewport.height);
}

async function expectHeaderAtTopOfScreen(dialog: Locator) {
  const header = await boundingBox(
    dialog.locator('[data-slot="dialog-header"]'),
  );
  expect(header.y).toBe(0);
}

async function expectFooterAtBottomOfScreen(dialog: Locator) {
  const footer = await boundingBox(
    dialog.locator('[data-slot="dialog-footer"]'),
  );
  const viewport = await viewportSize(dialog.page());
  expect(footer.y + footer.height).toBeCloseTo(viewport.height, 0);
}

async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element is not rendered, so its geometry cannot be read.');
  }
  return box;
}

// The live visual viewport, which is what a `fixed` element resolves against.
function viewportSize(page: Page) {
  return page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
}
