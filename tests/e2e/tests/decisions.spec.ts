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
    await authenticatedPage.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    // 4. Wait for the page to load
    // The heading shows the instance name (which takes priority over template name)
    await expect(
      authenticatedPage.getByRole('heading', { name: instance.name, level: 2 }),
    ).toBeVisible({ timeout: 15000 });

    // 5. Click the "Start a proposal" button
    const submitButton = authenticatedPage.getByRole('button', {
      name: 'Start a proposal',
    });
    await expect(submitButton).toBeVisible({ timeout: 15_000 });

    // Bind the response waiter before clicking so we don't miss a fast response,
    // and so the test fails fast with a clear signal if the mutation never fires
    // (e.g. when React Aria's onPress handler hasn't bound yet on a slow CI run).
    const createProposalResponse = authenticatedPage.waitForResponse(
      (resp) => resp.url().includes('decision.createProposal') && resp.ok(),
      { timeout: 30_000 },
    );

    await submitButton.click();
    await createProposalResponse;

    // 6. Wait for navigation to the proposal edit page
    // The URL pattern is /decisions/{slug}/proposal/{profileId}/edit
    await authenticatedPage.waitForURL(
      new RegExp(`/decisions/${instance.slug}/proposal/[^/]+/edit`),
      { timeout: 15_000 },
    );

    // 7. Verify we're on the proposal editor page
    // The ProposalEditor shows "Untitled Proposal" heading and has a "Submit" button
    await expect(authenticatedPage.getByText('Untitled proposal')).toBeVisible({
      timeout: 10000,
    });

    await expect(
      authenticatedPage.getByRole('button', { name: 'Submit', exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('vanity URL `/[locale]/columbus` renders the decision page', async ({
    authenticatedPage,
    org,
  }) => {
    // Seed a decision whose slug matches the `VANITY_DECISION_SLUGS` allowlist
    // in `apps/app/next.config.mjs`. The rewrite turns `/en/columbus` into the
    // existing `/en/decisions/columbus` route on the server while the URL bar
    // keeps the vanity path.
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
      slug: 'columbus',
    });

    await authenticatedPage.goto(`/en/${instance.slug}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      authenticatedPage.getByRole('heading', { name: instance.name, level: 2 }),
    ).toBeVisible({ timeout: 15000 });
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/en/${instance.slug}(?:[/?#]|$)`),
    );
  });
});
