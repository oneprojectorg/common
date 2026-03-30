import { createDecisionInstance, getSeededTemplate } from '@op/test';

import { expect, test } from '../fixtures/index.js';

test.describe('Role Permission Optimistic Updates', () => {
  test('rapid checkbox clicks on different permissions are all preserved', async ({
    authenticatedPage: page,
    org,
  }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      grantAdminAccess: true,
    });

    // Navigate to Process Builder → Roles & permissions section
    await page.goto(`/en/decisions/${instance.slug}/edit?section=roles`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for the roles table to load
    await expect(
      page.getByRole('heading', { name: 'Roles & permissions' }),
    ).toBeVisible({ timeout: 15000 });

    // Create a role to test with
    await page.getByRole('button', { name: 'Add role' }).click();

    const roleNameInput = page.getByPlaceholder('Role name…');
    await roleNameInput.fill('Test Role');
    await roleNameInput.press('Enter');

    // Wait for the role to be created and permission data to load
    await expect(page.getByText('Role created successfully')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForLoadState('networkidle');

    // Scope checkboxes to the row containing our new role
    const roleRow = page.getByRole('row').filter({ hasText: 'Test Role' });

    const reviewCheckbox = roleRow.getByRole('checkbox', {
      name: 'Review permission',
    });
    const voteCheckbox = roleRow.getByRole('checkbox', {
      name: 'Vote permission',
    });

    // Both should start unchecked
    await expect(reviewCheckbox).not.toBeChecked({ timeout: 5000 });
    await expect(voteCheckbox).not.toBeChecked();

    // Click both in rapid succession — force: true bypasses the styled div overlay
    await reviewCheckbox.click({ force: true });
    await voteCheckbox.click({ force: true });

    // Both should be checked immediately (optimistic update)
    await expect(reviewCheckbox).toBeChecked();
    await expect(voteCheckbox).toBeChecked();

    // Wait for the debounced mutation to complete
    await expect(page.getByText('Role updated successfully')).toBeVisible({
      timeout: 10000,
    });

    // After server response, both should still be checked (no revert)
    await expect(reviewCheckbox).toBeChecked();
    await expect(voteCheckbox).toBeChecked();
  });

  test('toggle-then-untoggle on same checkbox results in no change', async ({
    authenticatedPage: page,
    org,
  }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      grantAdminAccess: true,
    });

    await page.goto(`/en/decisions/${instance.slug}/edit?section=roles`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.getByRole('heading', { name: 'Roles & permissions' }),
    ).toBeVisible({ timeout: 15000 });

    // Create a test role
    await page.getByRole('button', { name: 'Add role' }).click();
    const roleNameInput = page.getByPlaceholder('Role name…');
    await roleNameInput.fill('Toggle Test Role');
    await roleNameInput.press('Enter');

    await expect(page.getByText('Role created successfully')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForLoadState('networkidle');

    const roleRow = page
      .getByRole('row')
      .filter({ hasText: 'Toggle Test Role' });

    const reviewCheckbox = roleRow.getByRole('checkbox', {
      name: 'Review permission',
    });

    // Should start unchecked
    await expect(reviewCheckbox).not.toBeChecked({ timeout: 5000 });

    // Toggle on then off rapidly
    await reviewCheckbox.click({ force: true });
    await reviewCheckbox.click({ force: true });

    // Should be back to unchecked (net zero change)
    await expect(reviewCheckbox).not.toBeChecked();

    // Wait to ensure no stale server response flips it back on
    await page.waitForTimeout(1000);
    await expect(reviewCheckbox).not.toBeChecked();
  });
});
