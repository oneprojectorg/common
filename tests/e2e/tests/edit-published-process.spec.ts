import { createDecisionInstance, getSeededTemplate } from '@op/test';

import { expect, test } from '../fixtures/index.js';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Edit Published Process', () => {
  test('enabling review on a phase shows Review Rubric and fields survive navigation', async ({
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(120_000);

    // 1. Create a published process (review NOT enabled on any phase)
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // 2. Navigate to the process builder editor
    await authenticatedPage.goto(`/en/decisions/${instance.slug}/edit`);

    const sidebarNav = authenticatedPage.getByRole('navigation', {
      name: 'Section navigation',
    });

    // 3. Wait for the editor to load
    await expect(authenticatedPage.getByText('Process Overview')).toBeVisible({
      timeout: 18_000,
    });

    // 4. Verify Review Rubric is NOT in the sidebar
    await expect(
      sidebarNav.getByRole('button', { name: 'Review Rubric' }),
    ).not.toBeVisible();

    // 5. Navigate to the Review & Shortlist phase and enable review
    const reviewPhaseButton = sidebarNav.getByRole('button', {
      name: 'Review & Shortlist',
    });
    await expect(reviewPhaseButton).toBeVisible({ timeout: 6_000 });
    await reviewPhaseButton.click();

    // Wait for phase detail to load
    await expect(authenticatedPage.getByText('Proposal review')).toBeVisible({
      timeout: 12_000,
    });

    // Toggle "Proposal review" on
    const reviewToggle = authenticatedPage
      .getByText('Proposal review')
      .locator('..')
      .locator('..')
      .getByRole('button');
    await reviewToggle.click();

    // 6. Verify Review Rubric now appears in the sidebar
    const reviewRubricButton = sidebarNav.getByRole('button', {
      name: 'Review Rubric',
    });
    await expect(reviewRubricButton).toBeVisible({ timeout: 6_000 });

    // 7. Navigate to Review Rubric
    await reviewRubricButton.click();

    await expect(
      authenticatedPage.getByRole('heading', { name: 'Review Criteria' }),
    ).toBeVisible({ timeout: 12_000 });

    // 8. Add a rubric criterion
    const addButton = authenticatedPage.getByRole('button', {
      name: 'Add your first criterion',
    });
    await expect(addButton).toBeVisible({ timeout: 6_000 });
    await addButton.click();

    // 9. Verify the criterion was added
    await expect(
      authenticatedPage.getByRole('heading', { name: 'New criterion' }),
    ).toBeVisible({ timeout: 6_000 });

    // 10. Navigate away to Overview
    const overviewButton = sidebarNav.getByRole('button', {
      name: 'Overview',
    });
    await overviewButton.click();
    await expect(authenticatedPage.getByText('Process Overview')).toBeVisible({
      timeout: 12_000,
    });

    // 11. Verify Review Rubric is still in the sidebar
    await expect(reviewRubricButton).toBeVisible({ timeout: 6_000 });

    // 12. Navigate back to Review Rubric
    await reviewRubricButton.click();
    await expect(authenticatedPage.getByText('Review Criteria')).toBeVisible({
      timeout: 12_000,
    });

    // 13. Verify the criterion is still there
    await expect(
      authenticatedPage.getByRole('heading', { name: 'New criterion' }),
    ).toBeVisible({ timeout: 6_000 });
  });

  test('proposal template fields survive section navigation', async ({
    authenticatedPage,
    org,
  }) => {
    test.setTimeout(120_000);

    // 1. Create a published process instance
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // 2. Navigate to the process builder editor
    await authenticatedPage.goto(`/en/decisions/${instance.slug}/edit`);

    const sidebarNav = authenticatedPage.getByRole('navigation', {
      name: 'Section navigation',
    });

    // 3. Wait for the editor to load
    await expect(authenticatedPage.getByText('Process Overview')).toBeVisible({
      timeout: 18_000,
    });

    // 4. Navigate to Proposal Template
    const templateButton = sidebarNav.getByRole('button', {
      name: 'Proposal Template',
    });
    await templateButton.click();
    await expect(
      authenticatedPage.getByText('Proposal template').first(),
    ).toBeVisible({ timeout: 12_000 });

    // 5. Add a custom field via the sidebar
    const addFieldButton = authenticatedPage.getByRole('button', {
      name: 'Add field',
    });
    await expect(addFieldButton).toBeVisible({ timeout: 6_000 });
    await addFieldButton.click();
    await authenticatedPage
      .getByRole('menuitem', { name: 'Short text' })
      .click();

    // 6. Verify the field was added (card appears in the sortable list)
    await expect(authenticatedPage.getByText('Short text').first()).toBeVisible(
      { timeout: 6_000 },
    );

    // 7. Navigate away to Overview
    const overviewButton = sidebarNav.getByRole('button', {
      name: 'Overview',
    });
    await overviewButton.click();
    await expect(authenticatedPage.getByText('Process Overview')).toBeVisible({
      timeout: 12_000,
    });

    // 8. Navigate back to Proposal Template
    await templateButton.click();
    await expect(
      authenticatedPage.getByText('Proposal template').first(),
    ).toBeVisible({ timeout: 12_000 });

    // 9. Verify the custom field is still there
    await expect(authenticatedPage.getByText('Short text').first()).toBeVisible(
      { timeout: 6_000 },
    );
  });
});
