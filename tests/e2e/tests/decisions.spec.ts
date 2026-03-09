import { createDecisionInstance, getSeededTemplate } from '@op/test';

import { expect, test } from '../fixtures/index.js';

test.describe('Decisions', () => {
  test('can submit a proposal from decision page', async ({
    authenticatedPage,
    org,
  }) => {
    // 1. Get the seeded decision process template
    const template = await getSeededTemplate();

    // 2. Create a decision instance with access for the authenticated user
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // 3. Navigate to the decision page
    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    // 4. Wait for the page to load
    // The heading shows the instance name (which takes priority over template name)
    await expect(
      authenticatedPage.getByRole('heading', { name: instance.name }),
    ).toBeVisible({ timeout: 15000 });

    // 5. Click the "Submit a proposal" button
    const submitButton = authenticatedPage.getByRole('button', {
      name: 'Submit a proposal',
    });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    // 6. Wait for navigation to the proposal edit page
    // The URL pattern is /decisions/{slug}/proposal/{profileId}/edit
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/decisions/${instance.slug}/proposal/[^/]+/edit`),
      { timeout: 15000 },
    );

    // 7. Verify we're on the proposal editor page
    // The ProposalEditor shows "Untitled Proposal" heading and has a "Submit Proposal" button
    await expect(authenticatedPage.getByText('Untitled Proposal')).toBeVisible({
      timeout: 10000,
    });

    await expect(
      authenticatedPage.getByRole('button', { name: 'Submit Proposal' }),
    ).toBeVisible({ timeout: 5000 });
  });
});
