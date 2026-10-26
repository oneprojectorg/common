import type { DecisionSchemaDefinition } from '@op/common';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
  likeProposal,
} from '@op/common/testing/data';
import { ProposalStatus, users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

const MY_OPEN_TITLE = 'My Results Bike Path';
const THEIR_OPEN_TITLE = 'Their Results Mural';
const MY_REJECTED_TITLE = 'My Results Skate Park';
const THEIR_REJECTED_TITLE = 'Their Results Fountain';

/**
 * One phase, nothing enabled on it. The current phase is index 0, so
 * `resolveManualSelectionStatus` reports selections as confirmed and `/current`
 * lands straight on ResultsPage. Voting never happened, so the ballot tab stays
 * off and the tabs are exactly Selected proposals / All proposals / My proposals.
 */
const resultsOnlySchema: DecisionSchemaDefinition = {
  id: 'test-results-proposal-tabs',
  version: '1.0.0',
  name: 'Results Proposal Tabs Schema',
  description: 'Single results phase so ResultsPage mounts.',
  phases: [
    {
      id: 'results',
      name: 'Results',
      rules: {
        proposals: { submit: false, review: false },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
    },
  ],
};

async function seedResultsListing(
  page: Page,
  org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  },
) {
  const [userRecord] = await db
    .select({ currentProfileId: users.currentProfileId })
    .from(users)
    .where(eq(users.authUserId, org.adminUser.authUserId));

  const myProfileId = userRecord?.currentProfileId;
  if (!myProfileId) {
    throw new Error('Expected the test user to have a current profile');
  }

  const template = await getSeededTemplate();
  const { instance, slug } = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: resultsOnlySchema,
  });

  const seed = [
    [myProfileId, MY_OPEN_TITLE, ProposalStatus.SUBMITTED],
    [org.organizationProfile.id, THEIR_OPEN_TITLE, ProposalStatus.SUBMITTED],
    [myProfileId, MY_REJECTED_TITLE, ProposalStatus.REJECTED],
    [org.organizationProfile.id, THEIR_REJECTED_TITLE, ProposalStatus.REJECTED],
  ] as const;

  const proposalProfileIds = new Map<string, string>();
  for (const [submittedByProfileId, title, status] of seed) {
    const proposal = await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      status,
      proposalData: { title, description: `<p>${title} details.</p>` },
    });
    proposalProfileIds.set(title, proposal.profileId);
  }

  // ResultsPage mounts the post-vote NPS survey over the page for a user who
  // has never answered it. Skipping it by cookie rather than by clicking
  // keeps this test about the tabs.
  await page.context().addCookies([
    {
      name: `survey-skipped-${instance.id}`,
      value: '1',
      url: 'http://localhost:4100',
    },
  ]);

  return { slug, myProfileId, proposalProfileIds };
}

test.describe('Results screen proposal tabs', () => {
  /**
   * The results tabs own the audience axis the same way the current-phase tabs
   * does, and the status select beside the list still composes with it — a
   * rejected proposal on each side means neither filter alone gives this answer.
   */
  test('adds My proposals to the results tabs and composes it with the status filter', async ({
    authenticatedPage,
    org,
  }) => {
    const { slug } = await seedResultsListing(authenticatedPage, org);

    await authenticatedPage.goto(`/en/decisions/${slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    const resultsTabs = authenticatedPage.getByRole('tablist', {
      name: 'Results sections',
    });
    const myProposalsTab = resultsTabs.getByRole('tab', {
      name: 'My proposals',
    });
    await expect(myProposalsTab).toBeVisible({ timeout: 30_000 });

    // The tabs that were already there, plus the new one. No ballot tab: this
    // instance never had a voting phase.
    await expect(
      resultsTabs.getByRole('tab', { name: 'Selected proposals' }),
    ).toBeVisible();
    await expect(
      resultsTabs.getByRole('tab', { name: 'All proposals' }),
    ).toBeVisible();
    await expect(
      resultsTabs.getByRole('tab', { name: 'My ballot' }),
    ).toHaveCount(0);

    await myProposalsTab.click();

    const theirRejected = authenticatedPage.getByRole('link', {
      name: THEIR_REJECTED_TITLE,
    });
    const myRejected = authenticatedPage.getByRole('link', {
      name: MY_REJECTED_TITLE,
    });
    const myOpen = authenticatedPage.getByRole('link', {
      name: MY_OPEN_TITLE,
    });

    await expect(myOpen).toBeVisible({ timeout: 30_000 });
    await expect(myRejected).toBeHidden();
    await expect(theirRejected).toBeHidden();

    // The tabs pin the audience axis here, so the select is the status axis
    // only — the same two controls as the current-phase screen.
    await authenticatedPage
      .getByRole('combobox', { name: 'Filter by status' })
      .click();
    await authenticatedPage
      .getByRole('option', { name: 'Not advanced' })
      .click();

    await expect(myOpen).toBeHidden({ timeout: 15_000 });
    await expect(theirRejected).toBeHidden();
    await expect(myRejected).toBeVisible();
  });
  test('narrows the results to what the reader liked from the status select', async ({
    authenticatedPage,
    org,
  }) => {
    const { slug, myProfileId, proposalProfileIds } = await seedResultsListing(
      authenticatedPage,
      org,
    );

    // Results cards are read-only, so the like is one made in an earlier phase.
    const likedProfileId = proposalProfileIds.get(THEIR_OPEN_TITLE);
    if (!likedProfileId) {
      throw new Error(`Expected "${THEIR_OPEN_TITLE}" to be seeded`);
    }
    await likeProposal({
      profileId: myProfileId,
      proposalProfileId: likedProfileId,
    });

    await authenticatedPage.goto(`/en/decisions/${slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    const resultsTabs = authenticatedPage.getByRole('tablist', {
      name: 'Results sections',
    });
    await resultsTabs.getByRole('tab', { name: 'All proposals' }).click();
    await authenticatedPage
      .getByRole('combobox', { name: 'Filter by status' })
      .click();
    await authenticatedPage.getByRole('option', { name: 'Liked' }).click();

    await expect(
      authenticatedPage.getByRole('link', { name: THEIR_OPEN_TITLE }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      authenticatedPage.getByRole('link', { name: MY_OPEN_TITLE }),
    ).toBeHidden();
  });
});
