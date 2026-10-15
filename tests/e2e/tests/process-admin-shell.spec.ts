import {
  createDecisionInstance,
  createOrganization,
  getSeededTemplate,
  grantDecisionProfileAccess,
} from '@op/common/testing/data';

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
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    await authenticatedPage.goto(`/en/decisions/${instance.slug}/manage`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      authenticatedPage.getByRole('heading', { name: instance.name, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('a participant who is not an admin cannot open the manage page', async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    const memberOrg = await createOrganization({
      testId: `process-admin-shell-${Date.now()}`,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
    });
    const memberUser = memberOrg.adminUser;

    await grantDecisionProfileAccess({
      profileId: instance.profileId,
      authUserId: memberUser.authUserId,
      email: memberUser.email,
      isAdmin: false,
    });

    const memberContext = await browser.newContext();
    try {
      const memberPage = await memberContext.newPage();
      await authenticateAsUser(memberPage, {
        email: memberUser.email,
        password: TEST_USER_DEFAULT_PASSWORD,
      });

      await memberPage.goto(`/en/decisions/${instance.slug}/manage`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(
        memberPage.getByRole('heading', {
          name: "You don't have access to this page",
          level: 1,
        }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        memberPage.getByRole('heading', { name: instance.name, level: 1 }),
      ).toHaveCount(0);
    } finally {
      await memberContext.close();
    }
  });

  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('a signed-out visitor is sent to login with the manage page as the return path', async ({
      page,
      org,
    }) => {
      const template = await getSeededTemplate();
      const instance = await createDecisionInstance({
        processId: template.id,
        ownerProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        schema: template.processSchema,
      });
      const managePath = `/en/decisions/${instance.slug}/manage`;

      await page.goto(managePath, { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 15_000 });
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(managePath);
    });
  });
});
