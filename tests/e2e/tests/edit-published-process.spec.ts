import {
  createDecisionInstance,
  getDecisionInstance,
  getSeededTemplate,
} from '@op/test';

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

    // 8. Add the first rubric criterion (defaults to required=true)
    const addFirstButton = authenticatedPage.getByRole('button', {
      name: 'Add your first criterion',
    });
    await expect(addFirstButton).toBeVisible({ timeout: 6_000 });
    await addFirstButton.click();
    await expect(
      authenticatedPage.getByText('Untitled field', { exact: true }).first(),
    ).toBeVisible({ timeout: 6_000 });

    // 9. Navigate away to Overview and back to verify criterion survives
    const overviewButton = sidebarNav.getByRole('button', {
      name: 'Overview',
    });
    await overviewButton.click();
    await expect(authenticatedPage.getByText('Process Overview')).toBeVisible({
      timeout: 12_000,
    });

    await expect(reviewRubricButton).toBeVisible({ timeout: 6_000 });
    await reviewRubricButton.click();
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Review Criteria' }),
    ).toBeVisible({ timeout: 12_000 });

    // Verify the criterion survived navigation
    await expect(
      authenticatedPage.getByText('Untitled field', { exact: true }).first(),
    ).toBeVisible({ timeout: 6_000 });

    // 10. Expand the first criterion and toggle Required off
    await authenticatedPage
      .getByText('Untitled field', { exact: true })
      .first()
      .click();
    const firstRequiredToggle = authenticatedPage.getByRole('button', {
      name: 'Required',
    });
    await expect(firstRequiredToggle).toBeVisible({ timeout: 3_000 });
    await firstRequiredToggle.click();

    // 11. Add a second criterion (keep it required)
    const addMoreButton = authenticatedPage.getByRole('button', {
      name: 'Add criterion',
    });
    await addMoreButton.click();

    // Wait for the second criterion to appear in the UI
    const criterionLabels = authenticatedPage.getByText('Untitled field', {
      exact: true,
    });
    await expect(criterionLabels.nth(1)).toBeVisible({ timeout: 6_000 });

    // 12. Click "Update Process" to persist all changes to the DB
    const footer = authenticatedPage.getByRole('contentinfo');
    const updateButton = footer.getByRole('button', {
      name: 'Update Process',
    });

    // Set up response listener before clicking to avoid race condition
    const saveResponse = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes('decision.updateDecisionInstance') && resp.ok(),
      { timeout: 12_000 },
    );
    await updateButton.click();
    await saveResponse;

    // 13. Verify the rubric template was persisted correctly
    await expect
      .poll(
        async () => {
          const saved = await getDecisionInstance(instance.instance.id);
          const data = saved.instanceData as Record<string, unknown>;
          return data.rubricTemplate as Record<string, unknown> | undefined;
        },
        { timeout: 6_000 },
      )
      .toBeDefined();

    const saved = await getDecisionInstance(instance.instance.id);
    const rubric = (saved.instanceData as Record<string, unknown>)
      .rubricTemplate as {
      properties: Record<string, unknown>;
      'x-field-order': string[];
      required?: string[];
    };

    // Two criteria in the template
    expect(Object.keys(rubric.properties)).toHaveLength(2);
    expect(rubric['x-field-order']).toHaveLength(2);

    // Only one is required (the second one — first was toggled off)
    expect(rubric.required ?? []).toHaveLength(1);

    // 14. "Update Process" navigates to the published view — go back to editor
    const settingsButton = authenticatedPage.getByRole('link', {
      name: 'Settings',
    });
    await expect(settingsButton).toBeVisible({ timeout: 12_000 });
    await settingsButton.click();

    // 15. Navigate to Review Rubric and verify both criteria survived
    const rubricButton = authenticatedPage
      .getByRole('navigation', { name: 'Section navigation' })
      .getByRole('button', { name: 'Review Rubric' });
    await expect(rubricButton).toBeVisible({ timeout: 6_000 });
    await rubricButton.click();
    await expect(authenticatedPage.getByText('Review Criteria')).toBeVisible({
      timeout: 12_000,
    });

    // Verify at least one criterion card is visible (DB already verified count=2)
    await expect(
      authenticatedPage.getByText('Untitled field', { exact: true }).first(),
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
