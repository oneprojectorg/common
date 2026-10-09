import type { DecisionSchemaDefinition } from '@op/common';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/common/testing/data';
import {
  ProposalStatus,
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionTransitionProposals,
  processInstances,
  proposalHistory,
  proposals as proposalsTable,
  stateTransitionHistory,
} from '@op/db/schema';
import { and, db, eq, inArray } from '@op/db/test';

import { expect, test } from '../fixtures/index.js';

type PhaseDefinition = DecisionSchemaDefinition['phases'][number];
type PhaseRules = PhaseDefinition['rules'];

/**
 * Proposals have to be authored somewhere before the phase under test can hold
 * them, so every schema below opens with this. Pass-all, so each proposal is
 * carried into the predecessor phase.
 */
const intakePhase: PhaseDefinition = {
  id: 'intake',
  name: 'Intake',
  rules: {
    proposals: { submit: true },
    voting: { submit: false },
    advancement: { method: 'manual' },
  },
  selectionPipeline: { version: '1.0.0', blocks: [] },
};

const resultsPhase: PhaseDefinition = {
  id: 'results',
  name: 'Results',
  rules: {
    proposals: { submit: false },
    voting: { submit: false },
    advancement: { method: 'manual' },
  },
};

/**
 * Every kind of phase an admin can enter a results phase *from*.
 *
 * A phase has no declared type — `isReviewPhase` / `isVotingPhase` read rule
 * flags, and "results" is just the last position — so the axis here is the rule
 * shape, and these four are the distinct values it takes. `deliberation` is the
 * no-capability case: a phase that only exists to hold proposals between two
 * others.
 *
 * Publishing is gated on `isLastPhase` alone, so the composer has to appear for
 * every one of them. It reaches two different screens: a review predecessor
 * routes to ReviewSelectionPage, the rest to FinalPhaseManualSelectionPage.
 */
const PREDECESSOR_KINDS: ReadonlyArray<{ id: string; rules: PhaseRules }> = [
  { id: 'submission', rules: { proposals: { submit: true } } },
  { id: 'review', rules: { proposals: { submit: false, review: true } } },
  { id: 'voting', rules: { voting: { submit: true } } },
  { id: 'deliberation', rules: {} },
];

/**
 * `limit: 0` strands every proposal on the way into `results`, so the inbound
 * transition lands empty — the state the manual-selection screens recover from,
 * and the only one that raises the composer.
 */
const buildSchema = (predecessor: {
  id: string;
  rules: PhaseRules;
}): DecisionSchemaDefinition => ({
  id: `test-results-notifications-${predecessor.id}`,
  version: '1.0.0',
  name: `Results Notifications (${predecessor.id} predecessor)`,
  description: `Intake → ${predecessor.id} → Results; results is last, so selection publishes.`,
  phases: [
    intakePhase,
    {
      id: predecessor.id,
      name: predecessor.id,
      rules: { advancement: { method: 'manual' }, ...predecessor.rules },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'zero', type: 'limit', count: 0 }],
      },
    },
    resultsPhase,
  ],
});

type SeedOrg = {
  organizationProfile: { id: string };
  adminUser: { authUserId: string; email: string };
};

/**
 * Parks an instance on `predecessorId` with every proposal attached to the
 * intake→predecessor transition, so they sit in that phase's pool. The
 * transition *out* of it is left to the test, which drives it through the UI.
 */
async function seedOnPredecessorPhase({
  org,
  schema,
  predecessorId,
  titles,
}: {
  org: SeedOrg;
  schema: DecisionSchemaDefinition;
  predecessorId: string;
  titles: string[];
}) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema,
  });

  // Insert as DRAFT then update to SUBMITTED so the proposalHistory trigger
  // (AFTER UPDATE only) writes the snapshot rows decisionTransitionProposals
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

  const proposalIds = proposals.map((proposal) => proposal.id);
  await db
    .update(proposalsTable)
    .set({ status: ProposalStatus.SUBMITTED })
    .where(inArray(proposalsTable.id, proposalIds));

  await db
    .update(processInstances)
    .set({ currentStateId: predecessorId })
    .where(eq(processInstances.id, instance.instance.id));

  const [intakeTransition] = await db
    .insert(stateTransitionHistory)
    .values({
      processInstanceId: instance.instance.id,
      fromStateId: intakePhase.id,
      toStateId: predecessorId,
      transitionData: {},
    })
    .returning();
  if (!intakeTransition) {
    throw new Error(`Failed to seed intake→${predecessorId} transition`);
  }

  const historyRows = await db
    .select({ id: proposalHistory.id, historyId: proposalHistory.historyId })
    .from(proposalHistory)
    .where(inArray(proposalHistory.id, proposalIds));

  await db.insert(decisionTransitionProposals).values(
    historyRows.map((row) => ({
      processInstanceId: instance.instance.id,
      transitionHistoryId: intakeTransition.id,
      proposalId: row.id,
      proposalHistoryId: row.historyId,
    })),
  );

  return { instance, proposals };
}

test.describe('Results phase notifications — every predecessor phase kind', () => {
  for (const predecessor of PREDECESSOR_KINDS) {
    test(`admin composes author notifications entering results from a ${predecessor.id} phase`, async ({
      authenticatedPage: page,
      org,
    }) => {
      const { instance, proposals } = await seedOnPredecessorPhase({
        org,
        schema: buildSchema(predecessor),
        predecessorId: predecessor.id,
        titles: ['Proposal Alpha', 'Proposal Beta', 'Proposal Gamma'],
      });
      // Gamma is never picked — it is what makes the not-funded audience 1.
      const [alpha, beta] = proposals;
      if (!alpha || !beta) {
        throw new Error('Expected the first two seeded proposals');
      }

      // Advance predecessor → results from the overview's PhaseTimeline, which
      // renders an Advance button only for the next phase.
      await page.goto(`/en/decisions/${instance.slug}`, {
        waitUntil: 'networkidle',
      });
      await page.getByRole('button', { name: 'Advance' }).first().click();
      const advanceDialog = page
        .getByRole('alertdialog')
        .and(page.locator(':not([data-slot="toast"])'));
      await advanceDialog
        .getByRole('button', { name: 'Advance Phase' })
        .click();
      await expect(advanceDialog).not.toBeVisible({ timeout: 15_000 });
      await page.goto(`/en/decisions/${instance.slug}/current`, {
        waitUntil: 'networkidle',
      });

      // The final-phase footer, whichever screen the predecessor routed to.
      const confirmButton = page.getByRole('button', {
        name: 'Confirm winning proposals',
      });
      await expect(confirmButton).toBeVisible({ timeout: 15_000 });
      await expect(confirmButton).toBeDisabled();

      await page
        .getByRole('button', { name: 'Advance Proposal Alpha' })
        .click();
      await page.getByRole('button', { name: 'Advance Proposal Beta' }).click();
      await expect(
        page.getByText('2 winning proposals selected'),
      ).toBeVisible();
      await expect(confirmButton).toBeEnabled();

      await confirmButton.click();
      // The seeded proposals request no budget, so each award has to be
      // entered before the notifications step.
      const amountsDialog = page.getByRole('dialog', {
        name: 'Confirm winning proposals',
      });
      await amountsDialog.getByRole('button', { name: 'Continue' }).click();
      const amountFields = amountsDialog.getByRole('textbox', {
        name: 'Awarded amount',
      });
      await expect(amountFields).toHaveCount(2);
      await amountFields.nth(0).fill('1000');
      await amountFields.nth(1).fill('2000');
      await amountsDialog.getByRole('button', { name: 'Continue' }).click();

      const dialog = page.getByRole('dialog', {
        name: 'Compose Notifications',
      });
      await expect(dialog).toBeVisible();

      // Both audiences are addressable, and the not-funded count is the pool
      // minus the picks — the set listResultNotificationRecipients resolves.
      await expect(
        dialog.getByRole('tab', { name: 'Funded 2 proposals' }),
      ).toBeVisible();
      await expect(
        dialog.getByRole('tab', { name: 'Not funded 1 proposal' }),
      ).toBeVisible();

      // `keepMounted` leaves the inactive panel in the DOM under `inert`, which
      // Playwright's role engine ignores — scope to the live panel explicitly.
      const activeMessageBox = dialog
        .locator('[role="tabpanel"]:not([inert])')
        .getByRole('textbox', { name: 'Notification Message' });
      const selectedMessage = `Funded copy from ${predecessor.id}`;
      const notSelectedMessage = `Not funded copy from ${predecessor.id}`;
      await activeMessageBox.fill(selectedMessage);
      await dialog.getByRole('tab', { name: /Not funded/ }).click();
      await activeMessageBox.fill(notSelectedMessage);

      await dialog
        .getByRole('button', { name: 'Send & publish results' })
        .click();
      await expect(dialog).not.toBeVisible({ timeout: 15_000 });

      // The composed copy reaches the transition row the notification workflow
      // re-reads at send time. Addressed by phase, not by recency.
      const [transitionRow] = await db
        .select({ transitionData: stateTransitionHistory.transitionData })
        .from(stateTransitionHistory)
        .where(
          and(
            eq(stateTransitionHistory.processInstanceId, instance.instance.id),
            eq(stateTransitionHistory.toStateId, resultsPhase.id),
          ),
        );
      expect(transitionRow?.transitionData).toMatchObject({
        manualSelection: {
          resultNotifications: {
            selected: selectedMessage,
            notSelected: notSelectedMessage,
          },
        },
      });

      // Two result rows: advancing into a last phase writes an empty one, then
      // this publish writes ours. Matched on content rather than `executedAt`
      // order — both can share a timestamp and `id` is not monotonic.
      const resultRows = await db
        .select()
        .from(decisionProcessResults)
        .where(
          eq(decisionProcessResults.processInstanceId, instance.instance.id),
        );
      expect(resultRows.every((row) => row.success)).toBe(true);
      expect(resultRows.map((row) => row.selectedCount).sort()).toEqual([0, 2]);

      const published = resultRows.find((row) => row.selectedCount === 2);
      if (!published) {
        throw new Error('Expected a published decision_process_results row');
      }

      const selections = await db
        .select({ proposalId: decisionProcessResultSelections.proposalId })
        .from(decisionProcessResultSelections)
        .where(
          eq(decisionProcessResultSelections.processResultId, published.id),
        );
      expect(new Set(selections.map((s) => s.proposalId))).toEqual(
        new Set([alpha.id, beta.id]),
      );
    });
  }
});
