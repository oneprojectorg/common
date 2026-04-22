import type { DecisionSchemaDefinition } from '@op/common';
import {
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
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

  const proposals = await Promise.all(
    titles.map((title) =>
      createProposal({
        processInstanceId: instance.instance.id,
        submittedByProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        proposalData: { title },
        status: ProposalStatus.SUBMITTED,
      }),
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

    await expect(
      authenticatedPage.getByText('CONFIRM THE WINNING PROPOSALS'),
    ).toBeVisible({ timeout: 15_000 });

    const advanceButton = authenticatedPage.getByRole('button', {
      name: /^Advance \(\d+\)$/,
    });
    await expect(advanceButton).toBeDisabled();

    await authenticatedPage
      .getByRole('checkbox', { name: /Proposal Alpha/ })
      .click();
    await authenticatedPage
      .getByRole('checkbox', { name: /Proposal Beta/ })
      .click();
    await expect(
      authenticatedPage.getByRole('button', { name: 'Advance (2)' }),
    ).toBeEnabled();

    await authenticatedPage
      .getByRole('button', { name: 'Advance (2)' })
      .click();
    const dialog = authenticatedPage.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'Confirm advancing proposals' }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish results' }).click();

    await expect(
      authenticatedPage.getByRole('heading', { name: 'Selection recorded' }),
    ).toBeVisible({ timeout: 15_000 });
    await authenticatedPage.getByRole('button', { name: 'Done' }).click();

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
      authenticatedPage.getByRole('button', { name: /^Advance \(\d+\)$/ }),
    ).not.toBeVisible();
  });

  test('non-admin sees the pending empty state and cannot interact', async ({
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

    await expect(memberPage.getByText('WAITING ON YOUR ADMIN')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      memberPage.getByRole('button', { name: /^Advance \(\d+\)$/ }),
    ).not.toBeVisible();
  });
});
