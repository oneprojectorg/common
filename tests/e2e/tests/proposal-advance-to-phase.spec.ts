import type { DecisionSchemaDefinition } from '@op/common';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/common/testing/data';
import {
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  proposalHistory,
  proposals as proposalsTable,
  stateTransitionHistory,
} from '@op/db/schema';
import { db, desc, eq, inArray } from '@op/db/test';

import { expect, test } from '../fixtures/index.js';

const schema: DecisionSchemaDefinition = {
  id: 'test-advance-to-phase',
  version: '1.0.0',
  name: 'Advance To Phase Test Schema',
  description: 'submission → review → final, advanced manually.',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'manual' },
      },
    },
    {
      id: 'review',
      name: 'Review',
      rules: {
        proposals: { submit: false },
        advancement: { method: 'manual' },
      },
    },
    {
      id: 'final',
      name: 'Final',
      rules: {
        proposals: { submit: false },
        advancement: { method: 'manual' },
      },
    },
  ],
};

test.describe('Advance a proposal into the current phase', () => {
  test('admin advances a proposal the review phase left behind', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema,
    });

    // INSERT-as-DRAFT then UPDATE so the proposal_history trigger writes the
    // snapshot rows the transition attaches.
    const [kept, leftBehind] = await Promise.all(
      ['Proposal Kept', 'Proposal Left Behind'].map((title) =>
        createProposal({
          processInstanceId: instance.instance.id,
          submittedByProfileId: org.organizationProfile.id,
          authUserId: org.adminUser.authUserId,
          email: org.adminUser.email,
          proposalData: { title },
          status: ProposalStatus.DRAFT,
        }),
      ),
    );
    if (!kept || !leftBehind) {
      throw new Error('Expected two seeded proposals');
    }
    await db
      .update(proposalsTable)
      .set({ status: ProposalStatus.SUBMITTED })
      .where(inArray(proposalsTable.id, [kept.id, leftBehind.id]));

    // Land in `review` with only `kept` carried over.
    await db
      .update(processInstances)
      .set({ currentStateId: 'review' })
      .where(eq(processInstances.id, instance.instance.id));
    const [transition] = await db
      .insert(stateTransitionHistory)
      .values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        transitionData: {},
      })
      .returning();
    const [keptHistory] = await db
      .select({ historyId: proposalHistory.historyId })
      .from(proposalHistory)
      .where(eq(proposalHistory.id, kept.id))
      .orderBy(desc(proposalHistory.historyCreatedAt))
      .limit(1);
    if (!transition || !keptHistory) {
      throw new Error('Failed to seed the review transition');
    }
    await db.insert(decisionTransitionProposals).values({
      processInstanceId: instance.instance.id,
      transitionHistoryId: transition.id,
      proposalId: kept.id,
      proposalHistoryId: keptHistory.historyId,
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${leftBehind.profileId}`,
      { waitUntil: 'load' },
    );

    await authenticatedPage
      .getByRole('button', { name: 'Proposal options' })
      .click();
    await authenticatedPage
      .getByRole('menuitem', { name: 'Advance to Review' })
      .click();

    await expect(authenticatedPage.getByText('Advanced to Review')).toBeVisible(
      { timeout: 15_000 },
    );

    const attached = await db
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.transitionHistoryId, transition.id),
      );
    expect(attached.map((row) => row.proposalId).sort()).toEqual(
      [kept.id, leftBehind.id].sort(),
    );

    // Now in the phase, so the item is gone.
    await authenticatedPage
      .getByRole('button', { name: 'Proposal options' })
      .click();
    await expect(
      authenticatedPage.getByRole('menuitem', { name: 'Delete' }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole('menuitem', { name: 'Advance to Review' }),
    ).toHaveCount(0);
  });
});
