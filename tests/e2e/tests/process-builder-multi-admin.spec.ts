import {
  createDecisionInstance,
  createOrganization,
  getDecisionInstance,
  getSeededTemplate,
  grantDecisionProfileAccess,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Regression test for the COWOP stale-localStorage bug.
 *
 * Visiting the editor of a published process used to persist a full server
 * snapshot to localStorage. When another admin later saved changes via
 * "Update Process", the first admin's stale snapshot shadowed the fresh
 * server data — they couldn't see the other admin's edits in the editor
 * (and saving would silently revert them).
 */
test.describe('Process Builder multi-admin editing', () => {
  test("admin sees another admin's saved changes after revisiting the editor", async ({
    authenticatedPage,
    browser,
    org,
    supabaseAdmin,
  }) => {
    test.setTimeout(180_000);

    // 1. Create a published process owned by the worker org.
    //    `authenticatedPage` (admin A / "Sarah") is an admin of this org.
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // 2. Create a second admin (admin B / "Casimiro") with admin access
    //    on the decision profile, in their own browser context.
    const otherOrg = await createOrganization({
      testId: `pb-multi-admin-${Date.now()}`,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
    });
    await grantDecisionProfileAccess({
      profileId: instance.profileId,
      authUserId: otherOrg.adminUser.authUserId,
      email: otherOrg.adminUser.email,
      isAdmin: true,
    });

    const contextB = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const pageB = await contextB.newPage();
    await authenticateAsUser(pageB, {
      email: otherOrg.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    const editUrl = `/en/decisions/${instance.slug}/edit`;
    const nameField = (page: typeof pageB) =>
      page.getByRole('textbox', { name: 'Process Name' });

    // 3. Admin B opens the editor BEFORE admin A makes any changes.
    //    (Pre-fix, this stamped a full snapshot into B's localStorage.)
    await pageB.goto(editUrl);
    await expect(pageB.getByText('Process Overview')).toBeVisible({
      timeout: 18_000,
    });
    await expect(nameField(pageB)).toBeVisible({ timeout: 12_000 });

    // 4. Admin A renames the process and clicks "Update Process".
    await authenticatedPage.goto(editUrl);
    await expect(authenticatedPage.getByText('Process Overview')).toBeVisible({
      timeout: 18_000,
    });

    const newName = `Renamed by Sarah ${Date.now()}`;
    const nameInputA = nameField(authenticatedPage);
    await expect(nameInputA).toBeVisible({ timeout: 12_000 });
    await nameInputA.fill(newName);
    await expect(nameInputA).toHaveValue(newName);

    // Let the form watcher propagate the edit into the store buffer
    await authenticatedPage.waitForTimeout(1_500);

    const footer = authenticatedPage.getByRole('contentinfo');
    const saveResponse = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes('decision.updateDecisionInstance') && resp.ok(),
      { timeout: 12_000 },
    );
    await footer.getByRole('button', { name: 'Update Process' }).click();
    await saveResponse;

    // 5. Verify the rename actually reached the DB — isolates any failure
    //    below to B's read path rather than A's save path.
    await expect
      .poll(
        async () => {
          const saved = await getDecisionInstance(instance.instance.id);
          return saved.name;
        },
        { timeout: 6_000 },
      )
      .toBe(newName);

    // 6. Admin B revisits the editor and must see A's saved name.
    //    Pre-fix: B's stale localStorage snapshot shadowed it.
    await pageB.goto(editUrl);
    await expect(pageB.getByText('Process Overview')).toBeVisible({
      timeout: 18_000,
    });
    await expect(nameField(pageB)).toHaveValue(newName, { timeout: 12_000 });

    await contextB.close();
  });
});
