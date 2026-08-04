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

type ProposalSpec = { title: string; budget?: number };

/** Lands an instance on `submission` with N published proposals — the
 *  starting state for driving the real submission→final advance via the UI. */
async function seedSubmissionPhaseInstance(
  org: SeedOrg,
  specs: ReadonlyArray<string | ProposalSpec>,
) {
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
    specs.map((spec) => {
      const { title, budget } =
        typeof spec === 'string' ? { title: spec, budget: undefined } : spec;
      return createProposal({
        processInstanceId: instance.instance.id,
        submittedByProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        proposalData: {
          title,
          ...(budget !== undefined
            ? { budget: { amount: budget, currency: 'USD' } }
            : {}),
        },
        status: ProposalStatus.DRAFT,
      });
    }),
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

    await authenticatedPage.goto(`/en/decisions/${instance.slug}/current`, {
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
    // Distinct budgets per proposal so the rendered "$X requested" labels can
    // be unambiguously attributed to the right card during assertions.
    const { instance, proposals } = await seedSubmissionPhaseInstance(org, [
      { title: 'Proposal Alpha', budget: 5000 },
      { title: 'Proposal Beta', budget: 8000 },
      { title: 'Proposal Gamma', budget: 7000 },
    ]);
    const [alpha, beta, gamma] = proposals;
    if (!alpha || !beta || !gamma) {
      throw new Error('Expected three seeded proposals');
    }

    // Drive submission → final via the overview's PhaseTimeline. #1458 moved
    // phase advancement off the sticky stepper and onto the overview's
    // Advance button. The limit:0 pipeline strands every proposal, so
    // onPhaseAdvanced writes an initial result row (selectedCount=0) before
    // the manual-selection UI mounts on /current.
    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });
    await authenticatedPage
      .getByRole('button', { name: 'Advance' })
      .first()
      .click();
    const advanceDialog = authenticatedPage
      .getByRole('alertdialog')
      .and(authenticatedPage.locator(':not([data-slot="toast"])'));
    await expect(advanceDialog).toBeVisible();
    await expect(advanceDialog.getByText('Advance to Final?')).toBeVisible();
    await advanceDialog.getByRole('button', { name: 'Advance Phase' }).click();
    // Wait for the mutation to complete and the modal to close before
    // navigating; otherwise /current may render the pre-advance phase.
    await expect(advanceDialog).not.toBeVisible({ timeout: 15_000 });
    await authenticatedPage.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'networkidle',
    });

    const confirmButton = authenticatedPage.getByRole('button', {
      name: 'Confirm winning proposals',
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
      authenticatedPage.getByText('2 winning proposals selected'),
    ).toBeVisible();
    await expect(confirmButton).toBeEnabled();

    await confirmButton.click();
    const dialog = authenticatedPage.getByRole('dialog', {
      name: 'Confirm winning proposals',
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish results' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // Channel invalidation swaps to ResultsPage and `?resultsLive=1` opens the
    // post-publish success modal on the submitter's machine. Dismissing it
    // strips the query param so the subsequent reload lands on a clean URL.
    const successDialog = authenticatedPage
      .getByRole('dialog')
      .filter({ hasText: 'Results are live!' });
    await expect(successDialog).toBeVisible({ timeout: 15_000 });
    await successDialog
      .getByRole('button', { name: 'View public results page' })
      .click();
    await expect(successDialog).not.toBeVisible({ timeout: 15_000 });

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

    // submitManualSelection writes selection rows with `allocated = null`.
    // The "allocated vs requested" UI only kicks in when a numeric allocation
    // exists, so we set one explicitly here to exercise that code path
    // end-to-end. Alpha gets a lower allocation than its request ($3k vs $5k);
    // Beta gets a higher one ($9k vs $8k) — the UI must render whatever the
    // pipeline produced, including over-allocation.
    await db
      .update(decisionProcessResultSelections)
      .set({ allocated: '3000' })
      .where(eq(decisionProcessResultSelections.proposalId, alpha.id));
    await db
      .update(decisionProcessResultSelections)
      .set({ allocated: '9000' })
      .where(eq(decisionProcessResultSelections.proposalId, beta.id));

    // The allocations above were written straight to the DB, bypassing the
    // app mutations that normally invalidate the query cache. React Query is
    // persisted to localStorage (PersistQueryClientProvider), so a plain
    // reload rehydrates the pre-update results (allocated=null) and renders
    // them stale-while-revalidate — a race the assertions below can lose.
    // Drop the persisted cache so the reload fetches the allocations fresh.
    await authenticatedPage.evaluate(() =>
      window.localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE'),
    );

    await authenticatedPage.reload({ waitUntil: 'networkidle' });

    // The post-results NPS survey modal (ProcessSurveyModal) opens on the
    // Results screen once its response query resolves; while open it inerts the
    // background, so the results content isn't reachable by role. Dismiss it if
    // it appears before asserting the funded list.
    await authenticatedPage
      .getByRole('button', { name: 'Maybe later' })
      .click({ timeout: 15_000 })
      .catch(() => {});

    const fundedHeading = authenticatedPage.getByRole('heading', {
      name: 'Selected Proposals',
    });
    await expect(fundedHeading).toBeVisible({ timeout: 15_000 });

    await expect(authenticatedPage.getByText('Proposal Alpha')).toBeVisible();
    await expect(authenticatedPage.getByText('Proposal Beta')).toBeVisible();
    await expect(authenticatedPage.getByText('Proposal Gamma')).toHaveCount(0);

    // Results page cards: allocated amount is the primary value, with the
    // original request rendered as "$X requested" alongside it.
    await expect(authenticatedPage.getByText('$3,000').first()).toBeVisible();
    await expect(authenticatedPage.getByText('$5,000 requested')).toBeVisible();
    await expect(authenticatedPage.getByText('$9,000').first()).toBeVisible();
    await expect(authenticatedPage.getByText('$8,000 requested')).toBeVisible();

    // Selected proposal — last phase, in selection: view page shows both
    // the allocated amount and the "$X requested" secondary label.
    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${alpha.profileId}`,
      { waitUntil: 'networkidle' },
    );
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Proposal Alpha' }),
    ).toBeVisible({ timeout: 15_000 });
    // The "Selected" badge is only rendered when a selection exists for this
    // proposal — proves the page consumed getLatestSelectionForProposal.
    await expect(authenticatedPage.getByText('Selected').first()).toBeVisible();
    await expect(authenticatedPage.getByText('$3,000').first()).toBeVisible();
    await expect(authenticatedPage.getByText('$5,000 requested')).toBeVisible();

    // Non-selected proposal — last phase, no selection record: view page
    // falls back to rendering only the proposal's requested budget. The
    // "$X requested" secondary label must NOT appear (nothing to compare).
    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${gamma.profileId}`,
      { waitUntil: 'networkidle' },
    );
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Proposal Gamma' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(authenticatedPage.getByText('$7,000').first()).toBeVisible();
    await expect(authenticatedPage.getByText(/requested/i)).toHaveCount(0);
    await expect(authenticatedPage.getByText('Selected').first()).toHaveCount(
      0,
    );
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
