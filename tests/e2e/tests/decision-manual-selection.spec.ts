import type { DecisionSchemaDefinition } from '@op/common';
import {
  ProposalStatus,
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionTransitionProposals,
  processInstances,
  proposals as proposalsTable,
  stateTransitionHistory,
} from '@op/db/schema';
import { db, eq, inArray } from '@op/db/test';
import {
  createDecisionInstance,
  createOrganization,
  createProposal,
  getSeededTemplate,
  grantDecisionProfileAccess,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Three-phase schema whose submission→review pipeline always selects zero.
 * Running advancePhase(submission → review) on this schema reproduces the real
 * "pipeline produced nothing" state that the admin manual selection screen
 * exists to recover from.
 */
const zeroSelectingSchema: DecisionSchemaDefinition = {
  id: 'test-manual-selection',
  version: '1.0.0',
  name: 'Manual Selection Test Schema',
  description: 'Pipeline limits submission → review to zero proposals.',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'zero', type: 'limit', count: 0 }],
      },
    },
    {
      id: 'review',
      name: 'Review',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
    },
    {
      id: 'final',
      name: 'Final',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
    },
  ],
};

/**
 * Two-phase schema whose submission→final pipeline always selects zero, and
 * whose `final` phase IS the last phase. Lands the instance in `final` with an
 * empty inbound transition — the exact state where the admin manual-selection
 * UI must produce a `decision_process_results` row that the Results screen
 * then reads.
 */
const lastPhaseZeroSelectingSchema: DecisionSchemaDefinition = {
  id: 'test-last-phase-manual-selection',
  version: '1.0.0',
  name: 'Last-phase Manual Selection Test Schema',
  description:
    'Pipeline limits submission → final to zero proposals; final is last.',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'zero', type: 'limit', count: 0 }],
      },
    },
    {
      id: 'final',
      name: 'Final',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
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
 * Seeds a decision instance with N proposals and lands it in the review phase
 * with an empty inbound transition — the exact DB state `advancePhase` would
 * produce when the submission→review pipeline selects zero proposals. The real
 * pipeline path is covered by backend unit tests; this shortcut avoids the
 * server-side import Playwright's runtime can't resolve.
 */
async function seedAwaitingInstance(org: SeedOrg, titles: string[]) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: zeroSelectingSchema,
  });

  // Insert as DRAFT then update to SUBMITTED so the proposal_history trigger
  // (AFTER UPDATE only) fires and writes the snapshot rows that
  // submitManualSelection joins against.
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

  await db
    .update(proposalsTable)
    .set({ status: ProposalStatus.SUBMITTED })
    .where(
      inArray(
        proposalsTable.id,
        proposals.map((p) => p.id),
      ),
    );

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
  if (!transition) {
    throw new Error('Failed to seed awaiting transition row');
  }

  return { instance, proposals, transition };
}

/**
 * Variant of {@link seedAwaitingInstance} that lands the instance in the
 * *last* phase (`final`) rather than the middle (`review`). This is the path
 * the post-commit `runResultsProcessing` hook in `submitManualSelection`
 * exists to handle: when the admin confirms a selection on the final phase,
 * the same call must also produce / update the `decision_process_results`
 * row that the Results screen reads. Proposals are seeded as APPROVED so
 * the default selection pipeline (`status === 'approved'` filter) carries
 * them through.
 */
async function seedAwaitingInstanceInLastPhase(org: SeedOrg, titles: string[]) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: lastPhaseZeroSelectingSchema,
  });

  // INSERT-as-DRAFT then UPDATE-to-APPROVED so the proposal_history trigger
  // (AFTER UPDATE only) writes the snapshot rows that submitManualSelection
  // joins against, while still landing each proposal in APPROVED so the
  // default selection pipeline accepts it.
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

  await db
    .update(proposalsTable)
    .set({ status: ProposalStatus.APPROVED })
    .where(
      inArray(
        proposalsTable.id,
        proposals.map((p) => p.id),
      ),
    );

  await db
    .update(processInstances)
    .set({ currentStateId: 'final' })
    .where(eq(processInstances.id, instance.instance.id));

  const [transition] = await db
    .insert(stateTransitionHistory)
    .values({
      processInstanceId: instance.instance.id,
      fromStateId: 'submission',
      toStateId: 'final',
      transitionData: {},
    })
    .returning();
  if (!transition) {
    throw new Error('Failed to seed awaiting transition row');
  }

  return { instance, proposals, transition };
}

test.describe('Decision Manual Selection — full flow', () => {
  test('pipeline selects zero → admin manually selects → proposals advance', async ({
    authenticatedPage,
    org,
  }) => {
    const { instance, proposals, transition } = await seedAwaitingInstance(
      org,
      ['Proposal Alpha', 'Proposal Beta', 'Proposal Gamma'],
    );
    const [alpha, beta] = proposals;

    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    // Wait for the admin UI to mount — the Confirm button is unique to
    // this branch and is present as soon as ManualSelectionList renders.
    const confirmButton = authenticatedPage.getByRole('button', {
      name: 'Confirm decisions',
    });
    await expect(confirmButton).toBeVisible({ timeout: 15_000 });
    await expect(confirmButton).toBeDisabled();

    // And the first row's toggle button should be present before we try
    // to click it.
    await expect(
      authenticatedPage.getByRole('button', { name: 'Advance Proposal Alpha' }),
    ).toBeVisible();

    // Each row's toggle button carries an aria-label of
    // `Advance <title>` while unselected and `Stop advancing <title>`
    // while selected.
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
    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Confirm advancing proposals',
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish' }).click();

    // After publish, the mutation awaits invalidation and then closes the
    // modal — no separate success dialog is shown.
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.transitionHistoryId, transition.id),
      );
    expect(joinRows.map((r) => r.proposalId).sort()).toEqual(
      [alpha!.id, beta!.id].sort(),
    );

    const [updated] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.id, transition.id));
    const manualSelection = (
      updated?.transitionData as {
        manualSelection?: { byProfileId?: string; at?: string };
      } | null
    )?.manualSelection;
    expect(manualSelection?.byProfileId).toBeTruthy();
    expect(manualSelection?.at).toBeTruthy();

    await authenticatedPage.reload({ waitUntil: 'networkidle' });
    // After confirming, selectionsAreConfirmed flips true and the admin UI
    // should no longer render — the Confirm decisions trigger is the
    // cleanest signal of that branch being mounted.
    await expect(
      authenticatedPage.getByRole('button', { name: 'Confirm decisions' }),
    ).not.toBeVisible();
  });

  test('last phase: subset selection produces a Results screen with only that subset', async ({
    authenticatedPage,
    org,
  }) => {
    const { instance, proposals } = await seedAwaitingInstanceInLastPhase(org, [
      'Proposal Alpha',
      'Proposal Beta',
      'Proposal Gamma',
    ]);
    const [alpha, beta, gamma] = proposals;
    if (!alpha || !beta || !gamma) {
      throw new Error('Expected three seeded proposals');
    }

    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    const confirmButton = authenticatedPage.getByRole('button', {
      name: 'Confirm decisions',
    });
    await expect(confirmButton).toBeVisible({ timeout: 15_000 });
    await expect(confirmButton).toBeDisabled();

    // Select a strict subset — Alpha + Beta — leaving Gamma unselected.
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
    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Confirm advancing proposals',
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // submitManualSelection's post-commit hook must have written exactly one
    // decision_process_results row for the instance, with selectedCount = 2
    // and selections pointing at Alpha + Beta only.
    const resultRows = await db
      .select()
      .from(decisionProcessResults)
      .where(
        eq(decisionProcessResults.processInstanceId, instance.instance.id),
      );
    expect(resultRows).toHaveLength(1);
    const resultRow = resultRows[0];
    if (!resultRow) {
      throw new Error('Expected a decision_process_results row');
    }
    expect(resultRow.selectedCount).toBe(2);
    expect(resultRow.success).toBe(true);

    const selections = await db
      .select({ proposalId: decisionProcessResultSelections.proposalId })
      .from(decisionProcessResultSelections)
      .where(eq(decisionProcessResultSelections.processResultId, resultRow.id));
    expect(new Set(selections.map((s) => s.proposalId))).toEqual(
      new Set([alpha.id, beta.id]),
    );

    // Re-render: selectionsAreConfirmed flips true and the router falls
    // through to ResultsPage. Funded Proposals must list exactly the subset.
    await authenticatedPage.reload({ waitUntil: 'networkidle' });

    const fundedHeading = authenticatedPage.getByRole('heading', {
      name: 'Funded Proposals',
    });
    await expect(fundedHeading).toBeVisible({ timeout: 15_000 });

    await expect(authenticatedPage.getByText('Proposal Alpha')).toBeVisible();
    await expect(authenticatedPage.getByText('Proposal Beta')).toBeVisible();
    await expect(authenticatedPage.getByText('Proposal Gamma')).toHaveCount(0);
  });

  test('non-admin does not see the admin manual-selection UI', async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    const { instance } = await seedAwaitingInstance(org, ['Pending Alpha']);

    const memberOrg = await createOrganization({
      testId: `manual-sel-member-${Date.now()}`,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
    });
    await grantDecisionProfileAccess({
      profileId: instance.profileId,
      authUserId: memberOrg.adminUser.authUserId,
      email: memberOrg.adminUser.email,
      isAdmin: false,
    });

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await authenticateAsUser(memberPage, {
      email: memberOrg.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    await memberPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    // Non-admin falls through to ProposalsList (no special "awaiting
    // admin" state). The Confirm decisions trigger is unique to the
    // admin branch, so it's the cleanest negative assertion.
    await expect(
      memberPage.getByRole('button', { name: 'Confirm decisions' }),
    ).not.toBeVisible();
  });
});
