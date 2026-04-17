import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  processInstances,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  type CreateOrganizationResult,
  type DecisionSchemaDefinition,
  createDecisionInstance,
  createInstanceMember,
  createOrganization,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

const REQUEST_COMMENT = 'Please add a detailed budget breakdown.';

/**
 * Schema with a submission → review → results layout where the review phase
 * has the `proposals.review: true` rule. Required for the proposal view's
 * `isInReviewPhase` gate to unlock the revision-submitted panel.
 */
const REVIEW_PHASE_SCHEMA = {
  id: 'proposal-view-revision-schema',
  version: '1.0.0',
  name: 'Proposal View Revision Schema',
  description: 'Test schema with a review-capable middle phase',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      description: 'Submit proposals',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'review',
      name: 'Review',
      description: 'Review proposals',
      rules: {
        proposals: { review: true },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'results',
      name: 'Results',
      description: 'Final results',
      rules: {
        proposals: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

/**
 * Builds a decision instance (advanced to the review phase) with a proposal
 * that has a RESUBMITTED revision request, plus three fresh users outside
 * the worker org: an author, a reviewer with the REVIEW role on the
 * instance, and an outsider with no instance access. The worker's org admin
 * is the decision admin (via createDecisionInstance).
 */
async function setupRevisionScenario({
  org,
  supabaseAdmin,
  testId,
}: {
  org: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
  testId: string;
}) {
  const template = await getSeededTemplate();

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: REVIEW_PHASE_SCHEMA,
  });

  // Advance to the review phase so the proposal view's review-phase gate
  // unlocks. `createDecisionInstance` starts in the first phase by default.
  await db
    .update(processInstances)
    .set({ currentStateId: 'review' })
    .where(eq(processInstances.id, instance.instance.id));

  const { user: author } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-author`,
    instanceProfileId: instance.profileId,
  });
  const { user: reviewer } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-reviewer`,
    instanceProfileId: instance.profileId,
  });
  // Grant the reviewer the REVIEW capability on the instance. Mirrors
  // production — the server now authorizes reviewers by the instance-level
  // REVIEW bit, not by proposal assignment membership.
  await grantInstanceReviewerRole({
    instanceProfileId: instance.profileId,
    authUserId: reviewer.authUserId,
    email: reviewer.email,
    roleName: `Reviewer-${testId}`,
  });
  const outsiderOrg = await createOrganization({
    testId: `${testId}-outsider`,
    supabaseAdmin,
    users: { admin: 1, member: 0 },
  });

  const { proposal, revisionRequest } = await createReviewScenario({
    instance: { id: instance.instance.id },
    author,
    reviewer: { profileId: reviewer.profileId },
    proposalData: {
      title: 'Community Solar Initiative',
      collaborationDocId: 'test-proposal-view-doc',
    },
    assignmentStatus: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    revisionRequest: {
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: REQUEST_COMMENT,
    },
  });

  if (!revisionRequest) {
    throw new Error('createReviewScenario did not return a revision request');
  }

  return {
    instance,
    proposal,
    revisionRequest,
    author,
    reviewer,
    outsider: outsiderOrg.adminUser,
  };
}

function proposalUrl(
  instanceSlug: string,
  proposalProfileId: string,
  revisionRequestId?: string,
) {
  const base = `/en/decisions/${instanceSlug}/proposal/${proposalProfileId}`;
  return revisionRequestId
    ? `${base}?reviewRevision=${revisionRequestId}`
    : base;
}

test.describe('Proposal View — revision submitted panel', () => {
  test('the author sees the revision submitted panel', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const scenario = await setupRevisionScenario({
      org,
      supabaseAdmin,
      testId: `rev-panel-author-${testInfo.workerIndex}-${Date.now()}`,
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: scenario.author.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    // Plain URL — toggle button is visible because a RESUBMITTED request exists.
    await page.goto(
      proposalUrl(scenario.instance.slug, scenario.proposal.profileId),
    );
    await expect(
      page.getByRole('heading', { name: 'Community Solar Initiative' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: 'Revision request' }),
    ).toBeVisible();

    // Panel open — author sees the submitted-revision content.
    await page.goto(
      proposalUrl(
        scenario.instance.slug,
        scenario.proposal.profileId,
        scenario.revisionRequest.id,
      ),
    );
    await expect(
      page.getByRole('heading', { name: 'Revision submitted' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(REQUEST_COMMENT)).toBeVisible();
  });

  test('a reviewer with the REVIEW role sees the revision submitted panel', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const scenario = await setupRevisionScenario({
      org,
      supabaseAdmin,
      testId: `rev-panel-reviewer-${testInfo.workerIndex}-${Date.now()}`,
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: scenario.reviewer.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(
      proposalUrl(
        scenario.instance.slug,
        scenario.proposal.profileId,
        scenario.revisionRequest.id,
      ),
    );

    await expect(
      page.getByRole('heading', { name: 'Revision submitted' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(REQUEST_COMMENT)).toBeVisible();
  });

  test('a decision admin sees the revision submitted panel', async ({
    authenticatedPage,
    org,
    supabaseAdmin,
  }, testInfo) => {
    // The worker admin who owns the instance via createDecisionInstance is
    // the decision admin — authenticatedPage is already signed in as them.
    const scenario = await setupRevisionScenario({
      org,
      supabaseAdmin,
      testId: `rev-panel-admin-${testInfo.workerIndex}-${Date.now()}`,
    });

    await authenticatedPage.goto(
      proposalUrl(
        scenario.instance.slug,
        scenario.proposal.profileId,
        scenario.revisionRequest.id,
      ),
    );

    await expect(
      authenticatedPage.getByRole('heading', { name: 'Revision submitted' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(authenticatedPage.getByText(REQUEST_COMMENT)).toBeVisible();
  });

  test('a user without instance access does not see the panel', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const scenario = await setupRevisionScenario({
      org,
      supabaseAdmin,
      testId: `rev-panel-outsider-${testInfo.workerIndex}-${Date.now()}`,
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: scenario.outsider.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(
      proposalUrl(
        scenario.instance.slug,
        scenario.proposal.profileId,
        scenario.revisionRequest.id,
      ),
    );

    // The revision-submitted panel must not render for a user with no
    // access to the decision instance.
    await expect(
      page.getByRole('heading', { name: 'Revision submitted' }),
    ).not.toBeVisible();
    await expect(page.getByText(REQUEST_COMMENT)).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Revision request' }),
    ).not.toBeVisible();
  });
});
