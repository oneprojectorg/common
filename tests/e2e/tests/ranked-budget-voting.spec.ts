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

const rankedBudgetSchema = {
  ...testVotingPhaseSchema,
  phases: testVotingPhaseSchema.phases.map((phase) => ({
    ...phase,
    rules: {
      ...phase.rules,
      voting: { submit: true, ranked: true, voterBudget: 1000 },
    },
  })),
};

const PRICES = {
  'Riverside Bike Path': 600,
  'Harbor Reading Room': 300,
  'Downtown Mural': 500,
} as const;

test.describe('Ranked voting with a voter budget', () => {
  test('ranks picks in ballot order and blocks a proposal over the remaining budget', async ({
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
    await expect(ballotToggle('Downtown Mural')).toBeDisabled();

    await authenticatedPage
      .getByRole('button', { name: '2 proposals selected' })
      .click();
    await authenticatedPage
      .getByRole('button', { name: 'Move Harbor Reading Room up' })
      .click();
    await expect(ballotToggle('Harbor Reading Room')).toHaveText('1');
    await authenticatedPage.keyboard.press('Escape');

    await authenticatedPage
      .getByRole('button', { name: 'Submit my votes' })
      .click();

    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Review your votes',
    });
    const ballot = dialog.getByRole('list', { name: 'Selected proposals' });
    await expect(ballot.getByRole('heading', { level: 3 })).toHaveText([
      'Harbor Reading Room',
      'Riverside Bike Path',
    ]);

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
      .where(eq(decisionsVoteProposals.voteSubmissionId, submission.id));
    const [bikePath, readingRoom] = proposals;
    expect(votes.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))).toEqual([
      { proposalId: readingRoom?.id, rank: 1 },
      { proposalId: bikePath?.id, rank: 2 },
    ]);
  });
});
