import type { DecisionSchemaDefinition } from '@op/common';
import { ProposalStatus, users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

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
      [
        org.organizationProfile.id,
        THEIR_REJECTED_TITLE,
        ProposalStatus.REJECTED,
      ],
    ] as const;

    for (const [submittedByProfileId, title, status] of seed) {
      await createProposal({
        processInstanceId: instance.id,
        submittedByProfileId,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        status,
        proposalData: { title, description: `<p>${title} details.</p>` },
      });
    }

    // ResultsPage mounts the post-vote NPS survey over the page for a user who
    // has never answered it. Skipping it by cookie rather than by clicking
    // keeps this test about the tabs.
    await authenticatedPage.context().addCookies([
      {
        name: `survey-skipped-${instance.id}`,
        value: '1',
        url: 'http://localhost:4100',
      },
    ]);

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
    await expect(myRejected).toBeVisible();
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
});
