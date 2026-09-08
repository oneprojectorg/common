import { ProposalStatus } from '@op/db/schema';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

/**
 * The collab mock (@op/collab/testing) serves fixture content for any doc ID
 * that doesn't contain "nonexistent", so the seeded cards render a summary.
 */
const MOCK_DOC_ID = 'test-card-dialog-doc';
const ALT_MOCK_DOC_ID = 'test-card-dialog-doc-alt';

/** Seeded last, so "newest first" puts it in the card the kebab below opens. */
const ACTED_ON_TITLE = 'Library Hours Extension';
const OTHER_TITLE = 'Riverside Cleanup';

/** Distinctive enough that finding it again proves it was never re-rendered. */
const REJECTION_NOTE = 'Overlaps the existing branch renovation budget.';
const REJECTION_REASON = 'Duplicate';

const SEEDED_CARD_COUNT = 2;
/** Submissions allowed before a stale list is called a failure, not a drop. */
const SUBMIT_ATTEMPTS = 3;

/**
 * The Delete and Reject dialogs used to live in `ProposalCardMenu`, so they hit
 * the bug ONE-1123 fixed for Merge: the grid hands card `i` to masonry column
 * `i % columns`, so one proposal arriving moved every card into a different
 * column and React remounted the menu that owned the dialog. Rejecting cost the
 * admin the most — the reason they had picked and the note they had typed went
 * with the dialog. Both are hosted above the grid now (ONE-1231), so a refreshed
 * list can't reach them.
 */
test.describe('Proposal card dialogs — a proposal arriving mid-action', () => {
  test('reject keeps the picked reason and typed note when the list refreshes', async ({
    authenticatedPage,
    org,
  }) => {
    const instanceSlug = await seedTwoProposalDecision(org);

    const proposalCardLinks = await openProposalList(
      authenticatedPage,
      instanceSlug,
    );

    await openCardMenuItem(authenticatedPage, 'Do not advance');

    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Do not advance',
    });
    const reason = dialog.getByRole('radio', { name: REJECTION_REASON });
    await reason.click();
    await expect(reason).toBeChecked();

    const note = dialog.getByLabel('Note to proposal author');
    await note.fill(REJECTION_NOTE);
    await expect(note).toHaveValue(REJECTION_NOTE);

    await refreshListFromAnotherTab(
      authenticatedPage,
      instanceSlug,
      proposalCardLinks,
    );

    // The rejection is still exactly where the admin left it. Neither value is
    // stored anywhere, so a remount is unrecoverable — they would have to pick
    // and retype both.
    await expect(dialog).toBeVisible();
    await expect(reason).toBeChecked();
    await expect(note).toHaveValue(REJECTION_NOTE);
  });

  test('delete stays open when the list refreshes', async ({
    authenticatedPage,
    org,
  }) => {
    const instanceSlug = await seedTwoProposalDecision(org);

    const proposalCardLinks = await openProposalList(
      authenticatedPage,
      instanceSlug,
    );

    await openCardMenuItem(authenticatedPage, 'Delete');

    const dialog = authenticatedPage.getByRole('alertdialog');
    await expect(dialog.getByText('Delete Proposal')).toBeVisible();

    await refreshListFromAnotherTab(
      authenticatedPage,
      instanceSlug,
      proposalCardLinks,
    );

    // A confirmation that vanishes mid-refresh reads as "it deleted something".
    await expect(dialog).toBeVisible();
  });
});

/** Two submitted proposals: the kebab hides admin actions on a draft. */
async function seedTwoProposalDecision(org: CreateOrganizationResult) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: template.processSchema,
  });

  for (const proposalData of [
    { title: OTHER_TITLE, collaborationDocId: MOCK_DOC_ID },
    { title: ACTED_ON_TITLE, collaborationDocId: ALT_MOCK_DOC_ID },
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

  return instance.slug;
}

/** Returns the card-link locator, already settled on the two seeded cards. */
async function openProposalList(page: Page, instanceSlug: string) {
  await page.goto(`/en/decisions/${instanceSlug}/current?filter=all`, {
    waitUntil: 'domcontentloaded',
  });

  // One per card: a draft card adds an Edit link under the same path, so the
  // count would otherwise jump by two when the new proposal lands.
  const proposalCardLinks = page.locator(
    'a[href*="/proposal/"]:not([href*="/edit"])',
  );
  await expect(proposalCardLinks).toHaveCount(SEEDED_CARD_COUNT, {
    timeout: 30_000,
  });

  return proposalCardLinks;
}

/** Opens the newest card's kebab and picks one item from it. */
async function openCardMenuItem(page: Page, itemName: string) {
  await page.getByRole('button', { name: 'Proposal options' }).first().click();
  await page.getByRole('menuitem', { name: itemName, exact: true }).click();
}

/**
 * A second tab submits a proposal, which is what refreshes the list behind the
 * open dialog. Without a refresh landing these tests would prove nothing, so
 * this returns only once the grid has actually grown.
 *
 * The refresh rides a Supabase broadcast, and those are not replayed — under
 * load one can be dropped, leaving the list stale forever. Submitting again is
 * the recovery, not waiting longer: each submission is a fresh broadcast, and
 * what the assertion needs is only that the list changed underneath the dialog.
 */
async function refreshListFromAnotherTab(
  page: Page,
  instanceSlug: string,
  proposalCardLinks: Locator,
) {
  const otherTab = await page.context().newPage();

  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt++) {
    await otherTab.goto(`/en/decisions/${instanceSlug}/current`, {
      waitUntil: 'domcontentloaded',
    });
    const startProposal = otherTab.getByRole('button', {
      name: 'Start a proposal',
    });
    await expect(startProposal).toBeEnabled({ timeout: 30_000 });
    // Armed before the click, so a fast response can't land first.
    const proposalCreated = otherTab.waitForResponse(
      (response) =>
        response.url().includes('decision.createProposal') && response.ok(),
      { timeout: 30_000 },
    );
    await startProposal.click();
    await proposalCreated;

    const listRefreshed = await expect
      .poll(() => proposalCardLinks.count(), { timeout: 15_000 })
      .toBeGreaterThan(SEEDED_CARD_COUNT)
      .then(
        () => true,
        () => false,
      );

    if (listRefreshed) {
      await otherTab.close();
      return;
    }
  }

  await otherTab.close();
  throw new Error(
    `The proposal list never refreshed after ${SUBMIT_ATTEMPTS} submissions from another tab.`,
  );
}
