import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createInstanceMember,
  getSeededTemplate,
} from '@op/common/testing/data';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

// E2E builds force every feature flag on, so `new_process_admin_enabled` is on
// here; the flag-off path is covered by the loadProcessAdmin unit test.
test.describe('Process admin shell', () => {
  test('an admin opens the manage page for their decision', async ({
    authenticatedPage,
    org,
  }) => {
    const { instance, managePath } = await seedDecision(org);

    await authenticatedPage.goto(managePath, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      authenticatedPage.getByRole('heading', { name: instance.name, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Process Overview',
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'About the process',
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole('link', { name: 'Back to editor' }),
    ).toHaveAttribute('href', new RegExp(`/decisions/${instance.slug}/edit$`));
  });

  test('a participant who is not an admin cannot open the manage page', async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    const { instance, managePath } = await seedDecision(org);

    const { user: memberUser } = await createInstanceMember({
      supabaseAdmin,
      testId: `process-admin-shell-${randomUUID().slice(0, 8)}`,
      instanceProfileId: instance.profileId,
    });

    const memberContext = await browser.newContext();
    try {
      const memberPage = await memberContext.newPage();
      await authenticateAsUser(memberPage, {
        email: memberUser.email,
        password: TEST_USER_DEFAULT_PASSWORD,
      });

      // The member can open the decision itself, so the denial below comes from
      // the admin check rather than from missing access.
      await memberPage.goto(`/en/decisions/${instance.slug}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(
        memberPage.getByRole('heading', { name: instance.name, level: 2 }),
      ).toBeVisible({ timeout: 15_000 });

      await memberPage.goto(managePath, {
        waitUntil: 'domcontentloaded',
      });

      await expectForbidden(memberPage, instance.name);
    } finally {
      await memberContext.close();
    }
  });

  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('a signed-out visitor cannot open the manage page', async ({
      page,
      org,
    }) => {
      const { instance, managePath } = await seedDecision(org);

      await page.goto(managePath, { waitUntil: 'domcontentloaded' });

      await expectForbidden(page, instance.name);
    });
  });
});

async function seedDecision(org: CreateOrganizationResult) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: template.processSchema,
  });

  return { instance, managePath: `/en/decisions/${instance.slug}/manage` };
}

async function expectForbidden(page: Page, decisionName: string) {
  await expect(
    page.getByRole('heading', {
      name: "You don't have access to this page",
      level: 1,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: decisionName, level: 1 }),
  ).toHaveCount(0);
}
