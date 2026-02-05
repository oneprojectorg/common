import { proposals } from '@op/db/schema';
import { db, eq } from '@op/db/test';
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

    // 3. Give the database a moment to ensure the transaction is committed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 4. Navigate to the decision page
    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    // 5. Wait for the page to load
    await expect(
      authenticatedPage.getByRole('heading', { name: template.name }),
    ).toBeVisible({ timeout: 15000 });

    // 6. Click the "Submit a proposal" button
    const submitButton = authenticatedPage.getByRole('button', {
      name: 'Submit a proposal',
    });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    // 7. Wait for navigation to the proposal edit page
    // The URL pattern is /decisions/{slug}/proposal/{profileId}/edit
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/decisions/${instance.slug}/proposal/[^/]+/edit`),
      { timeout: 15000 },
    );

    // 8. Verify we're on the proposal editor page
    // The ProposalEditor shows "Untitled Proposal" heading and has a "Submit Proposal" button
    await expect(authenticatedPage.getByText('Untitled Proposal')).toBeVisible({
      timeout: 10000,
    });

    await expect(
      authenticatedPage.getByRole('button', { name: 'Submit Proposal' }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('collaborative title saves to database and persists on reload', async ({
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

    // 3. Give the database a moment to ensure the transaction is committed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 4. Navigate to the decision page
    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    // 5. Wait for the page to load
    await expect(
      authenticatedPage.getByRole('heading', { name: template.name }),
    ).toBeVisible({ timeout: 15000 });

    // 6. Click the "Submit a proposal" button to create a new proposal
    const submitButton = authenticatedPage.getByRole('button', {
      name: 'Submit a proposal',
    });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    // 7. Wait for navigation to the proposal edit page
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/decisions/${instance.slug}/proposal/[^/]+/edit`),
      { timeout: 15000 },
    );

    // 8. Wait for the editor to be ready
    await expect(authenticatedPage.getByText('Untitled Proposal')).toBeVisible({
      timeout: 10000,
    });

    // 9. Extract the proposal profile ID from the URL
    const url = authenticatedPage.url();
    const urlMatch = url.match(/\/proposal\/([^/]+)\/edit/);
    if (!urlMatch?.[1]) {
      throw new Error('Could not extract proposal profile ID from URL');
    }
    const proposalProfileId = urlMatch[1];

    // 10. Type a unique title in the collaborative title field
    // The title field is the first ProseMirror editor on the page
    const uniqueTitle = `E2E Test Title ${Date.now()}`;
    const titleEditor = authenticatedPage.locator('.ProseMirror').first();
    await expect(titleEditor).toBeVisible({ timeout: 5000 });
    await titleEditor.click();
    await titleEditor.fill(uniqueTitle);

    // 11. Wait for the debounced save (1500ms debounce + network time)
    await authenticatedPage.waitForTimeout(3000);

    // 12. Verify title is saved in the database
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.profileId, proposalProfileId));

    expect(proposal).toBeDefined();
    const proposalData = proposal?.proposalData as { title?: string } | null;
    expect(proposalData?.title).toBe(uniqueTitle);

    // 13. Reload the page to verify Yjs persistence
    await authenticatedPage.reload({ waitUntil: 'networkidle' });

    // 14. Wait for the title editor to be visible after reload
    // Re-query the locator since DOM has changed after reload
    const titleEditorAfterReload = authenticatedPage
      .locator('.ProseMirror')
      .first();
    await expect(titleEditorAfterReload).toBeVisible({ timeout: 10000 });

    // 15. Wait for TipTap Cloud sync - the title should appear in the editor
    // Use polling to wait for the content to sync from Yjs
    await expect(titleEditorAfterReload).toHaveText(uniqueTitle, {
      timeout: 15000,
    });

    // 16. Also verify the title is visible in the page header
    // The layout displays the title from state, which is updated from Yjs onChange
    await expect(authenticatedPage.getByText(uniqueTitle).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
