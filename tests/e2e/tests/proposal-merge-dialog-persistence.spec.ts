import { ProposalStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * The collab mock (@op/collab/testing) serves fixture content for any doc ID
 * that doesn't contain "nonexistent", so the seeded cards render a summary.
 */
const MOCK_DOC_ID = 'test-merge-dialog-doc';
const ALT_MOCK_DOC_ID = 'test-merge-dialog-doc-alt';

/** Seeded last, so "newest first" puts it in the card the kebab below opens. */
const SOURCE_TITLE = 'Library Hours Extension';
/** The only merge candidate, so picking it needs no disambiguation. */
const TARGET_TITLE = 'Riverside Cleanup';

/**
 * A proposal submitted by someone else while an admin had the merge dialog open
 * used to take the dialog — and the target they had already picked — with it.
 * The grid hands card `i` to masonry column `i % columns`, so one new proposal
 * moved every card into a different column and React remounted the menu that
 * owned the dialog. The dialog is hosted above the grid now, so a refreshed
 * list can't reach it.
 */
test.describe('Merge proposals dialog — a proposal arriving mid-merge', () => {
  test('stays open on the picked target when the list refreshes underneath it', async ({
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

    // Both submitted: the kebab hides Merge on a draft, and the picker hides
    // drafts as targets.
    for (const proposalData of [
      { title: TARGET_TITLE, collaborationDocId: MOCK_DOC_ID },
      { title: SOURCE_TITLE, collaborationDocId: ALT_MOCK_DOC_ID },
    ]) {
      await createProposal({
        processInstanceId: instance.instance.id,
        submittedByProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        status: ProposalStatus.SUBMITTED,
        proposalData,
      });
    }

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/current?filter=all`,
      { waitUntil: 'domcontentloaded' },
    );

    // One per card: a draft card adds an Edit link under the same path, so the
    // count would otherwise jump by two when the new proposal lands.
    const proposalCardLinks = authenticatedPage.locator(
      'a[href*="/proposal/"]:not([href*="/edit"])',
    );
    await expect(proposalCardLinks).toHaveCount(2, { timeout: 30_000 });

    await authenticatedPage
      .getByRole('button', { name: 'Proposal options' })
      .first()
      .click();
    await authenticatedPage
      .getByRole('menuitem', { name: 'Merge with another proposal' })
      .click();

    // Naming the source proves the kebab we opened was the expected card's.
    const dialog = authenticatedPage.getByRole('dialog');
    await expect(dialog.getByText(SOURCE_TITLE).first()).toBeVisible();

    // Pick the one candidate — this is the choice the bug threw away.
    await dialog.getByText(TARGET_TITLE).click();
    const pickedTarget = dialog.getByRole('button', {
      name: 'Select a different proposal',
    });
    await expect(pickedTarget).toBeVisible();

    // A second tab submits a proposal. Armed before the click: the channel
    // invalidation is what refreshes the list behind the open dialog, and
    // without it this test would prove nothing.
    const listRefreshed = authenticatedPage.waitForResponse(
      (response) =>
        response.url().includes('decision.listProposals') && response.ok(),
      { timeout: 30_000 },
    );

    const otherTab = await authenticatedPage.context().newPage();
    await otherTab.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });
    const startProposal = otherTab.getByRole('button', {
      name: 'Start a proposal',
    });
    await expect(startProposal).toBeEnabled({ timeout: 30_000 });
    const proposalCreated = otherTab.waitForResponse(
      (response) =>
        response.url().includes('decision.createProposal') && response.ok(),
      { timeout: 30_000 },
    );
    await startProposal.click();
    await proposalCreated;
    await otherTab.close();

    await listRefreshed;
    await expect(proposalCardLinks).toHaveCount(3, { timeout: 20_000 });

    // The merge is still exactly where the admin left it.
    await expect(dialog).toBeVisible();
    await expect(pickedTarget).toBeVisible();
    await expect(dialog.getByText(TARGET_TITLE)).toBeVisible();
  });
});
