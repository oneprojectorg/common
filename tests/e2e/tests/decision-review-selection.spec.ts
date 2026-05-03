import type { DecisionSchemaDefinition } from '@op/common';
import {
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  proposalHistory,
  proposals as proposalsTable,
  stateTransitionHistory,
} from '@op/db/schema';
import { db, eq, inArray } from '@op/db/test';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Three-phase schema with a real review phase. Mirrors what the simple
 * voting template produces post-`d89a46a31`: every transition is `manual`,
 * `review` exposes `proposals.review === true` so DecisionStateRouter can
 * detect the ReviewSelection branch, and neither review nor voting carry a
 * selectionPipeline (so advances default to pass-none, leaving the new
 * inbound transition empty).
 */
const reviewToVotingSchema: DecisionSchemaDefinition = {
  id: 'test-review-selection',
  version: '1.0.0',
  name: 'Review Selection Test Schema',
  description:
    'Submission → Review (review enabled) → Voting; manual transitions; pass-none defaults.',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
      // Pass-all so submission→review carries every submitted proposal forward.
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    {
      id: 'review',
      name: 'Review & Shortlist',
      rules: {
        proposals: { submit: false, review: true },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
      // `limit: 0` forces a pass-none result on review→voting so the new
      // inbound transition is empty, which is exactly the state
      // ReviewSelectionPage exists to recover from. Mirrors the
      // `decision-manual-selection.spec.ts` shortcut. Once the recently-merged
      // pass-none default lands in this branch, this can simply be omitted.
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'zero', type: 'limit', count: 0 }],
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'manual' },
      },
    },
  ],
};

type SeedOrg = {
  organizationProfile: { id: string };
  adminUser: { authUserId: string; email: string };
};

/**
 * Seeds an instance currently on the `review` phase with proposals already
 * attached to the submission→review transition (so they're in review's pool).
 * The review→voting transition is intentionally absent — the test drives the
 * stepper to create it via `transitionFromPhase`.
 */
async function seedOnReviewPhase(org: SeedOrg, titles: string[]) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: reviewToVotingSchema,
  });

  // Insert as DRAFT then update to SUBMITTED so the proposalHistory trigger
  // (AFTER UPDATE only) writes the snapshot rows that decisionTransitionProposals
  // foreign-keys against.
  const proposals = await Promise.all(
    titles.map((title) =>
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

  const proposalIds = proposals.map((p) => p.id);
  await db
    .update(proposalsTable)
    .set({ status: ProposalStatus.SUBMITTED })
    .where(inArray(proposalsTable.id, proposalIds));

  // Park the instance on `review`.
  await db
    .update(processInstances)
    .set({ currentStateId: 'review' })
    .where(eq(processInstances.id, instance.instance.id));

  // submission→review: stamp every proposal so they're in review's pool.
  const [reviewTransition] = await db
    .insert(stateTransitionHistory)
    .values({
      processInstanceId: instance.instance.id,
      fromStateId: 'submission',
      toStateId: 'review',
      transitionData: {},
    })
    .returning();
  if (!reviewTransition) {
    throw new Error('Failed to seed submission→review transition');
  }

  const historyRows = await db
    .select({ id: proposalHistory.id, historyId: proposalHistory.historyId })
    .from(proposalHistory)
    .where(inArray(proposalHistory.id, proposalIds));

  await db.insert(decisionTransitionProposals).values(
    historyRows.map((row) => ({
      processInstanceId: instance.instance.id,
      transitionHistoryId: reviewTransition.id,
      proposalId: row.id,
      proposalHistoryId: row.historyId,
    })),
  );

  return { instance, proposals };
}

test.describe('Decision Review Selection — review → voting flow', () => {
  test('admin advances from review via stepper, then shortlists into voting', async ({
    authenticatedPage,
    org,
  }) => {
    const { instance, proposals } = await seedOnReviewPhase(org, [
      'Proposal Alpha',
      'Proposal Beta',
      'Proposal Gamma',
    ]);
    const [alpha, beta] = proposals;

    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    // ── 1. Currently on Review: admin sees ReviewPage, *not* ReviewSelectionPage.
    // The "Overall recommendation" column header is unique to ReviewSelectionTable;
    // its absence here is a tombstone for the routing fork.
    await expect(
      authenticatedPage.getByRole('columnheader', {
        name: 'Overall recommendation',
      }),
    ).not.toBeVisible();

    // ── 2. Click the next-phase circle in the stepper ("Start Voting").
    // Manual transitions + admin → that step's IconButton is interactive.
    await authenticatedPage
      .getByRole('button', { name: 'Start Voting' })
      .first()
      .click();

    // ── 3. Confirm the advance in the stepper modal.
    const advanceDialog = authenticatedPage.getByRole('dialog');
    await expect(advanceDialog).toBeVisible();
    await expect(advanceDialog.getByText('Advance to Voting?')).toBeVisible();
    await advanceDialog.getByRole('button', { name: 'Advance Phase' }).click();

    // ── 4. Phase transition fires `transitionFromPhase`. Once it lands the
    // page re-fetches, `selectionsAreConfirmed` flips to false (review→voting
    // inbound transition is empty), and DecisionStateRouter routes to
    // ReviewSelectionPage. The "Overall recommendation" header is the cleanest
    // signal that the new branch mounted.
    await expect(
      authenticatedPage.getByRole('columnheader', {
        name: 'Overall recommendation',
      }),
    ).toBeVisible({ timeout: 15_000 });

    // The transition row exists in the DB with the manual-trigger marker.
    const [createdVotingTransition] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instance.instance.id))
      .orderBy(stateTransitionHistory.transitionedAt);
    // (Ordered ascending — pull the most recent row separately.)
    const votingHistory = await db
      .select()
      .from(stateTransitionHistory)
      .where(
        eq(stateTransitionHistory.processInstanceId, instance.instance.id),
      );
    const votingTransition = votingHistory.find(
      (r) => r.fromStateId === 'review' && r.toStateId === 'voting',
    );
    expect(createdVotingTransition).toBeDefined();
    expect(votingTransition).toBeDefined();

    // ── 5. Continue with the selection flow.
    const confirmButton = authenticatedPage.getByRole('button', {
      name: 'Confirm decisions',
    });
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeDisabled();

    await authenticatedPage
      .getByRole('button', { name: 'Advance Proposal Alpha' })
      .click();
    await authenticatedPage
      .getByRole('button', { name: 'Advance Proposal Beta' })
      .click();

    await expect(
      authenticatedPage.getByText('2 proposals advancing'),
    ).toBeVisible();
    await expect(confirmButton).toBeEnabled();

    await confirmButton.click();
    const confirmDialog = authenticatedPage.getByRole('dialog', {
      name: 'Confirm advancing proposals',
    });
    await expect(confirmDialog).toBeVisible();
    // Dialog copy mentions the destination phase — currentStateId === voting.
    await expect(
      confirmDialog.getByText('move on to the Voting phase'),
    ).toBeVisible();

    await confirmDialog.getByRole('button', { name: 'Publish' }).click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 15_000 });

    // ── 6. submitManualSelection stamps the empty review→voting transition
    // with the chosen proposals and a manualSelection audit.
    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          votingTransition!.id,
        ),
      );
    expect(joinRows.map((r) => r.proposalId).sort()).toEqual(
      [alpha!.id, beta!.id].sort(),
    );

    const [updated] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.id, votingTransition!.id));
    const manualSelection = (
      updated?.transitionData as {
        manualSelection?: { byProfileId?: string; at?: string };
      } | null
    )?.manualSelection;
    expect(manualSelection?.byProfileId).toBeTruthy();
    expect(manualSelection?.at).toBeTruthy();

    // ── 7. After confirming, selectionsAreConfirmed flips back to true and
    // ReviewSelectionPage no longer renders.
    await authenticatedPage.reload({ waitUntil: 'networkidle' });
    await expect(
      authenticatedPage.getByRole('columnheader', {
        name: 'Overall recommendation',
      }),
    ).not.toBeVisible();
  });
});
