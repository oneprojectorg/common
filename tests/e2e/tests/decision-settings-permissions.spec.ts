import {
  createDecisionInstance,
  createUser,
  getSeededTemplate,
  grantDecisionProfileAccess,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

test.describe('Decision Settings Permissions', () => {
  test('settings button is only visible to admin users', async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    // 1. Get the seeded decision process template
    const template = await getSeededTemplate();

    // 2. Create a decision instance
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // 3. Create a non-admin (member) user and grant them access
    const memberEmail = `settings-perm-member-${Date.now()}@oneproject.org`;
    const member = await createUser({
      supabaseAdmin,
      email: memberEmail,
    });

    await grantDecisionProfileAccess({
      profileId: instance.profileId,
      authUserId: member.id,
      email: member.email,
      isAdmin: false,
    });

    // 4. Authenticate as the member user and navigate to the decision page
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await authenticateAsUser(memberPage, {
      email: member.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await memberPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    await expect(
      memberPage.getByRole('heading', { name: instance.name }),
    ).toBeVisible({ timeout: 15000 });

    // 5. Assert the Settings button is NOT visible to the member
    const settingsLink = memberPage.getByRole('link', { name: /Settings/ });
    await expect(settingsLink).not.toBeVisible();

    // 6. Authenticate as the admin user and verify Settings IS visible
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await authenticateAsUser(adminPage, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await adminPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    await expect(
      adminPage.getByRole('heading', { name: instance.name }),
    ).toBeVisible({ timeout: 15000 });

    const adminSettingsLink = adminPage.getByRole('link', {
      name: /Settings/,
    });
    await expect(adminSettingsLink).toBeVisible({ timeout: 5000 });
  });
});
