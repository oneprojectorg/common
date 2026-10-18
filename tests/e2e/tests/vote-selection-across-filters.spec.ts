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

const TITLES = [
  'Riverside Bike Path',
  'Downtown Mural',
  'Harbor Reading Room',
] as const;

test.describe('Vote selection across filters', () => {
  test('submits every selected proposal when a filter hides some of them, without the ones deselected', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();
    const { instance, slug, name } = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: testVotingPhaseSchema,
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

    await authenticatedPage
      .getByRole('searchbox', { name: 'Search proposals' })
      .fill('bike path');
    await expect(ballotToggle('Downtown Mural')).toBeHidden({
      timeout: 15_000,
    });
    await expect(
      authenticatedPage.getByText('3 proposals selected'),
    ).toBeVisible();

    await ballotToggle('Riverside Bike Path').click();
    await expect(ballotToggle('Riverside Bike Path')).not.toBeChecked();
    await expect(
      authenticatedPage.getByText('2 proposals selected'),
    ).toBeVisible();

    await authenticatedPage
      .getByRole('button', { name: 'Submit my votes' })
      .click();

    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Review your votes',
    });
    const ballot = dialog.getByRole('list', { name: 'Selected proposals' });
    await expect(ballot.getByRole('heading', { level: 3 })).toHaveText([
      'Downtown Mural',
      'Harbor Reading Room',
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
      .select({ proposalId: decisionsVoteProposals.proposalId })
      .from(decisionsVoteProposals)
      .where(eq(decisionsVoteProposals.voteSubmissionId, submission.id));
    const [, mural, harbor] = proposals;
    expect(votes.map((vote) => vote.proposalId).sort()).toEqual(
      [mural?.id, harbor?.id].sort(),
    );
  });
});
