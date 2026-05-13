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
import { db, desc, eq, inArray } from '@op/db/test';
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

/** submission→review pipeline selects zero — reproduces the "pipeline
 *  produced nothing" state the admin manual selection screen recovers from. */
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

/** submission→final pipeline selects zero, and `final` is last —
 *  exercises the in-transaction processResults call in submitManualSelection. */
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

/** Lands an instance in `review` with an empty inbound transition — the DB
 *  state advancePhase produces when submission→review selects zero. */
async function seedAwaitingInstance(org: SeedOrg, titles: string[]) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: zeroSelectingSchema,
  });

  // INSERT-as-DRAFT then UPDATE so the proposal_history AFTER UPDATE trigger
  // fires; submitManualSelection joins against those snapshot rows.
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

/** Lands an instance on `submission` with N published proposals — the
 *  starting state for driving the real submission→final advance via the UI. */
async function seedSubmissionPhaseInstance(org: SeedOrg, titles: string[]) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: lastPhaseZeroSelectingSchema,
  });

  // INSERT-as-DRAFT then UPDATE to SUBMITTED so the proposal_history AFTER
  // UPDATE trigger fires; submitManualSelection joins against those snapshots.
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

  return { instance, proposals };
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

    const confirmButton = authenticatedPage.getByRole('button', {
      name: 'Confirm decisions',
    });
    await expect(confirmButton).toBeVisible({ timeout: 15_000 });
    await expect(confirmButton).toBeDisabled();

    await expect(
      authenticatedPage.getByRole('button', { name: 'Advance Proposal Alpha' }),
    ).toBeVisible();

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
    await expect(
      authenticatedPage.getByRole('button', { name: 'Confirm decisions' }),
    ).not.toBeVisible();
  });

  test('last phase: subset selection produces a Results screen with only that subset', async ({
    authenticatedPage,
    org,
  }) => {
    const { instance, proposals } = await seedSubmissionPhaseInstance(org, [
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

    // Drive submission → final via the stepper. The limit:0 pipeline strands
    // every proposal, so onPhaseAdvanced writes an initial result row
    // (selectedCount=0) before the manual-selection UI mounts.
    await authenticatedPage
      .getByRole('button', { name: 'Start Final' })
      .first()
      .click();
    const advanceDialog = authenticatedPage.getByRole('dialog');
    await expect(advanceDialog).toBeVisible();
    await expect(advanceDialog.getByText('Advance to Final?')).toBeVisible();
    await advanceDialog.getByRole('button', { name: 'Advance Phase' }).click();

    const confirmButton = authenticatedPage.getByRole('button', {
      name: 'Confirm decisions',
    });
    await expect(confirmButton).toBeVisible({ timeout: 15_000 });
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
    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Confirm advancing proposals',
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // Append-only: post-advance hook writes the initial row (selectedCount=0);
    // submitManualSelection writes a second row (selectedCount=2) inline.
    const resultRows = await db
      .select()
      .from(decisionProcessResults)
      .where(eq(decisionProcessResults.processInstanceId, instance.instance.id))
      .orderBy(desc(decisionProcessResults.executedAt));
    expect(resultRows).toHaveLength(2);
    const [latestRow, earliestRow] = resultRows;
    if (!latestRow || !earliestRow) {
      throw new Error('Expected two decision_process_results rows');
    }
    expect(earliestRow.selectedCount).toBe(0);
    expect(latestRow.selectedCount).toBe(2);
    expect(latestRow.success).toBe(true);

    const selections = await db
      .select({ proposalId: decisionProcessResultSelections.proposalId })
      .from(decisionProcessResultSelections)
      .where(eq(decisionProcessResultSelections.processResultId, latestRow.id));
    expect(new Set(selections.map((s) => s.proposalId))).toEqual(
      new Set([alpha.id, beta.id]),
    );

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

    await expect(
      memberPage.getByRole('button', { name: 'Confirm decisions' }),
    ).not.toBeVisible();
  });
});
