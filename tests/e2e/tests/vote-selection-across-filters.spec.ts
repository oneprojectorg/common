import type { DecisionSchemaDefinition } from '@op/common';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/common/testing/data';
import {
  ProposalStatus,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';

import { expect, test } from '../fixtures/index.js';

const votingPhaseSchema: DecisionSchemaDefinition = {
  id: 'test-vote-selection-across-filters',
  version: '1.0.0',
  name: 'Vote Selection Across Filters',
  description: 'A single voting phase.',
  phases: [
    {
      id: 'voting',
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'manual' as const },
      },
    },
  ],
};

const TITLES = [
  'Riverside Bike Path',
  'Downtown Mural',
  'Harbor Reading Room',
] as const;

test.describe('Vote selection across filters', () => {
  /**
   * The ballot is the voter's selection, not whatever the list happens to show:
   * narrowing the list after choosing must not drop the hidden choices from the
   * confirmation or from the submitted vote.
   */
  test('submits every selected proposal when a filter hides some of them', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();
    const { instance, slug, name } = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: votingPhaseSchema,
    });

    const proposals = await Promise.all(
      TITLES.map((title) =>
        createProposal({
          processInstanceId: instance.id,
          submittedByProfileId: org.organizationProfile.id,
          status: ProposalStatus.SUBMITTED,
          proposalData: { title, description: `<p>${title} details.</p>` },
        }),
      ),
    );

    await authenticatedPage.goto(`/en/decisions/${slug}/current`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    // Each card's own checkbox, found through the card that carries the title.
    const ballotToggle = (title: string) =>
      authenticatedPage
        .getByRole('button', { name: /select proposal/i })
        .filter({ hasText: title })
        .getByRole('checkbox');

    for (const title of TITLES) {
      await ballotToggle(title).click();
      await expect(ballotToggle(title)).toBeChecked();
    }
    await expect(
      authenticatedPage.getByText('3 proposals selected'),
    ).toBeVisible();

    // Narrow the list to one of the three.
    await authenticatedPage
      .getByRole('searchbox', { name: 'Search proposals' })
      .fill('bike path');
    await expect(ballotToggle('Downtown Mural')).toBeHidden({
      timeout: 15_000,
    });
    await expect(ballotToggle('Harbor Reading Room')).toBeHidden();
    await expect(ballotToggle('Riverside Bike Path')).toBeVisible();
    await expect(
      authenticatedPage.getByText('3 proposals selected'),
    ).toBeVisible();

    await authenticatedPage
      .getByRole('button', { name: 'Submit my votes' })
      .click();

    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Review your votes',
    });
    const ballot = dialog.getByRole('list', { name: 'Selected proposals' });
    // Card headings, not list items: each mini card nests a list of its own.
    await expect(ballot.getByRole('heading', { level: 3 })).toHaveCount(
      TITLES.length,
    );
    for (const title of TITLES) {
      await expect(ballot.getByRole('heading', { name: title })).toBeVisible();
    }

    await dialog.getByRole('button', { name: 'Submit votes' }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    const [submission] = await db
      .select({ id: decisionsVoteSubmissions.id })
      .from(decisionsVoteSubmissions)
      .where(eq(decisionsVoteSubmissions.processInstanceId, instance.id));
    if (!submission) {
      throw new Error('Expected the ballot to be recorded');
    }

    const votes = await db
      .select({ proposalId: decisionsVoteProposals.proposalId })
      .from(decisionsVoteProposals)
      .where(eq(decisionsVoteProposals.voteSubmissionId, submission.id));
    expect(votes.map((vote) => vote.proposalId).sort()).toEqual(
      proposals.map((proposal) => proposal.id).sort(),
    );
  });
});
