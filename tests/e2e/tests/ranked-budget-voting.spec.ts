import type { DecisionSchemaDefinition } from '@op/common';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
  testVotingPhaseSchema,
} from '@op/common/testing/data';
import {
  ProposalStatus,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';

import { expect, test } from '../fixtures/index.js';

const [votingPhase] = testVotingPhaseSchema.phases;

const rankedBudgetSchema = {
  ...testVotingPhaseSchema,
  phases: [
    {
      ...votingPhase,
      rules: {
        ...votingPhase.rules,
        voting: { submit: true, ranked: true, voterBudget: 1000 },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

const PRICES = {
  'Riverside Bike Path': 600,
  'Harbor Reading Room': 300,
  'Downtown Mural': 500,
} as const;

test.describe('Ranked voting with a voter budget', () => {
  test('ranks picks in ballot order and blocks a proposal over the remaining budget until room is made', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();
    const { instance, slug, name } = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: rankedBudgetSchema,
    });

    const proposals = await Promise.all(
      Object.entries(PRICES).map(([title, amount]) =>
        createProposal({
          processInstanceId: instance.id,
          submittedByProfileId: org.organizationProfile.id,
          status: ProposalStatus.SUBMITTED,
          proposalData: {
            title,
            description: `<p>${title} details.</p>`,
            budget: { amount, currency: 'USD' },
          },
        }),
      ),
    );

    await authenticatedPage.goto(`/en/decisions/${slug}/current`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    const ballotToggle = (title: string) =>
      authenticatedPage
        .getByRole('button', { name: /select proposal/i })
        .filter({ hasText: title })
        .getByRole('checkbox');

    await ballotToggle('Riverside Bike Path').click();
    await ballotToggle('Harbor Reading Room').click();
    await expect(ballotToggle('Riverside Bike Path')).toHaveText('1');
    await expect(ballotToggle('Harbor Reading Room')).toHaveText('2');

    const meter = authenticatedPage.getByRole('progressbar', {
      name: 'Budget allocated',
    });
    await expect(meter).toHaveAttribute(
      'aria-valuetext',
      '$900 of $1,000 allocated',
    );
    const muralCard = authenticatedPage
      .getByRole('button', { name: /select proposal/i })
      .filter({ hasText: 'Downtown Mural' });
    await expect(ballotToggle('Downtown Mural')).toBeDisabled();
    await expect(muralCard).toHaveAttribute('aria-disabled', 'true');
    await muralCard.click();
    await expect(
      authenticatedPage.getByText(
        'This proposal costs more than your remaining $100. Remove a pick to make room.',
      ),
    ).toBeVisible();
    await expect(meter).toHaveAttribute(
      'aria-valuetext',
      '$900 of $1,000 allocated',
    );

    // Keyboard rather than a click: in `next dev` the issues badge covers the
    // trigger; the production build CI runs has no badge.
    await authenticatedPage
      .getByRole('button', { name: '2 proposals selected' })
      .press('Enter');
    const popover = authenticatedPage.getByRole('dialog', {
      name: 'Your ballot',
    });
    await expect(
      popover.getByRole('button', { name: 'Move Riverside Bike Path up' }),
    ).toBeDisabled();
    await popover
      .getByRole('button', { name: 'Move Harbor Reading Room up' })
      .click();
    await expect(ballotToggle('Harbor Reading Room')).toHaveText('1');
    await expect(ballotToggle('Riverside Bike Path')).toHaveText('2');

    await popover
      .getByRole('button', {
        name: 'Remove Riverside Bike Path from your ballot',
      })
      .click();
    await expect(ballotToggle('Riverside Bike Path')).not.toBeChecked();
    await expect(meter).toHaveAttribute(
      'aria-valuetext',
      '$300 of $1,000 allocated',
    );
    await authenticatedPage.keyboard.press('Escape');
    await expect(popover).toBeHidden();

    await ballotToggle('Downtown Mural').click();
    await expect(ballotToggle('Downtown Mural')).toHaveText('2');

    await authenticatedPage
      .getByRole('button', { name: 'Submit my votes' })
      .click();

    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Review your votes',
    });
    const ballot = dialog.getByRole('list', { name: 'Selected proposals' });
    await expect(ballot.getByRole('heading', { level: 3 })).toHaveText([
      'Harbor Reading Room',
      'Downtown Mural',
    ]);
    await expect(
      dialog.getByRole('progressbar', { name: 'Budget allocated' }),
    ).toHaveAttribute('aria-valuetext', '$800 of $1,000 allocated');
    await expect(dialog.getByRole('note')).toContainText(
      'Your order is your ranking',
    );

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
      .select({
        proposalId: decisionsVoteProposals.proposalId,
        rank: decisionsVoteProposals.rank,
      })
      .from(decisionsVoteProposals)
      .where(eq(decisionsVoteProposals.voteSubmissionId, submission.id))
      .orderBy(decisionsVoteProposals.rank);
    const [, readingRoom, mural] = proposals;
    expect(votes).toEqual([
      { proposalId: readingRoom?.id, rank: 1 },
      { proposalId: mural?.id, rank: 2 },
    ]);

    await authenticatedPage.reload({ waitUntil: 'domcontentloaded' });
    const votedToggle = (title: string) =>
      authenticatedPage
        .getByTestId('proposal-card')
        .filter({ hasText: title })
        .getByRole('checkbox');
    await expect(votedToggle('Harbor Reading Room')).toHaveText('1', {
      timeout: 30_000,
    });
    await expect(votedToggle('Downtown Mural')).toHaveText('2');
  });
});
