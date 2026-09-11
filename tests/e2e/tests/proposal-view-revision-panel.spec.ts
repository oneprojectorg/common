import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  processInstances,
  proposalReviewRequests,
} from '@op/db/schema';
import { db, eq, inArray } from '@op/db/test';
import {
  type CreateOrganizationResult,
  type DecisionSchemaDefinition,
  createDecisionInstance,
  createInstanceMember,
  createOrganization,
  createReviewAssignment,
  createReviewScenario,
  createRevisionRequest,
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

const FIRST_REQUEST_COMMENT = 'Please add a detailed budget breakdown.';
const SECOND_REQUEST_COMMENT = 'Name the second site and confirm the permits.';
const AUTHOR_NOTE = 'Broke the budget out per site and named both locations.';

/**
 * Schema with a submission → review → results layout where the review phase
 * has the `proposals.review: true` rule. Required for the proposal view's
 * `isInReviewPhase` gate to unlock the review-notes panel.
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
 * carrying TWO revision requests from two different reviewers, plus users
 * outside the worker org: an author, two reviewers with the REVIEW role on the
 * instance, and an outsider with no instance access. The worker's org admin is
 * the decision admin (via createDecisionInstance).
 *
 * `state` decides whether the requests are still open (`REQUESTED`) or already
 * answered by one resubmission (`RESUBMITTED` — one note and one
 * `respondedProposalHistoryId` stamped on both rows, which is what groups them
 * into a single revision cycle).
 */
async function setupRevisionScenario({
  org,
  supabaseAdmin,
  testId,
  state,
}: {
  org: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
  testId: string;
  state: ProposalReviewRequestState;
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
  const { user: secondReviewer } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-reviewer2`,
    instanceProfileId: instance.profileId,
  });
  // Grant the reviewers the REVIEW capability on the instance. Mirrors
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

  const isAnswered = state === ProposalReviewRequestState.RESUBMITTED;

  const { proposal, assignedProposalHistoryId, revisionRequest } =
    await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: 'Community Solar Initiative',
        collaborationDocId: `test-proposal-view-doc-${testId}`,
      },
      assignmentStatus: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
      revisionRequest: {
        state,
        requestComment: FIRST_REQUEST_COMMENT,
      },
    });

  if (!revisionRequest) {
    throw new Error('createReviewScenario did not return a revision request');
  }

  // The second reviewer's request on the same proposal — the case the
  // review-notes sheet exists for.
  const secondAssignment = await createReviewAssignment({
    processInstanceId: instance.instance.id,
    proposalId: proposal.id,
    reviewerProfileId: secondReviewer.profileId,
    assignedProposalHistoryId,
    status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
  });
  const secondRequest = await createRevisionRequest({
    assignmentId: secondAssignment.id,
    state,
    requestComment: SECOND_REQUEST_COMMENT,
  });

  // One resubmission stamps the same note and version pointer on every request
  // it answers, in one statement — the pointer is what the grouped notes read
  // keys on, so both rows have to carry it.
  if (isAnswered) {
    await db
      .update(proposalReviewRequests)
      .set({
        responseComment: AUTHOR_NOTE,
        respondedAt: new Date().toISOString(),
        respondedProposalHistoryId: assignedProposalHistoryId,
      })
      .where(
        inArray(proposalReviewRequests.id, [
          revisionRequest.id,
          secondRequest.id,
        ]),
      );
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

test.describe('Proposal editor — review notes sheet', () => {
  test('the author answers both open requests with one revision', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const scenario = await setupRevisionScenario({
      org,
      supabaseAdmin,
      testId: `rev-sheet-${testInfo.workerIndex}-${Date.now()}`,
      state: ProposalReviewRequestState.REQUESTED,
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: scenario.author.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    // `?reviewRevision=<id>` is the deep link the request notification sends;
    // it names one request and the sheet lists every open one.
    await page.goto(
      `/en/decisions/${scenario.instance.slug}/proposal/${scenario.proposal.profileId}/edit?reviewRevision=${scenario.revisionRequest.id}`,
      { waitUntil: 'domcontentloaded' },
    );

    await expect(
      page.getByRole('heading', { name: 'Review notes' }),
    ).toBeVisible({ timeout: 36_000 });
    await expect(page.getByText(FIRST_REQUEST_COMMENT)).toBeVisible();
    await expect(page.getByText(SECOND_REQUEST_COMMENT)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Revision requests' }),
    ).toBeVisible();

    // The sheet slides over the editor and covers the header's actions, so
    // the author closes it before submitting — as they would in the product.
    const reviewNotesSheet = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Review notes' }),
    });
    await reviewNotesSheet.getByRole('button', { name: 'Close' }).click();
    await expect(reviewNotesSheet).toBeHidden();

    // One dialog, one note — not a reply per request.
    await page.getByRole('button', { name: 'Update' }).click();

    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Submit revision' }),
    });
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    const submitButton = dialog.getByRole('button', {
      name: 'Submit revision',
    });
    await expect(submitButton).toBeDisabled();

    await dialog.getByRole('textbox').fill(AUTHOR_NOTE);
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Only `onSuccess` navigates, so landing back on the decision is the
    // signal that the server accepted the one revision. The toast is not
    // asserted: it races with the navigation that fires alongside it.
    await expect(page).toHaveURL(
      new RegExp(`/decisions/${scenario.instance.slug}/current`),
      { timeout: 30_000 },
    );
  });
});

test.describe('Proposal View — revision notes panel', () => {
  test('the author sees their note above every request it answered', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const scenario = await setupRevisionScenario({
      org,
      supabaseAdmin,
      testId: `rev-panel-author-${testInfo.workerIndex}-${Date.now()}`,
      state: ProposalReviewRequestState.RESUBMITTED,
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: scenario.author.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    // Plain URL — the header's "Review notes" toggle is visible because an
    // answered revision cycle exists.
    await page.goto(
      proposalUrl(scenario.instance.slug, scenario.proposal.profileId),
    );
    await expect(
      page.getByRole('heading', { name: 'Community Solar Initiative' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: 'Review notes' }),
    ).toBeVisible();

    // Panel open — one note, both of the requests it answered.
    await page.goto(
      proposalUrl(
        scenario.instance.slug,
        scenario.proposal.profileId,
        scenario.revisionRequest.id,
      ),
    );
    await expect(
      page.getByRole('heading', { name: 'Your revision note' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(AUTHOR_NOTE)).toBeVisible();
    await expect(page.getByText(FIRST_REQUEST_COMMENT)).toBeVisible();
    await expect(page.getByText(SECOND_REQUEST_COMMENT)).toBeVisible();
  });

  test("a reviewer with the REVIEW role sees the author's note", async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const scenario = await setupRevisionScenario({
      org,
      supabaseAdmin,
      testId: `rev-panel-reviewer-${testInfo.workerIndex}-${Date.now()}`,
      state: ProposalReviewRequestState.RESUBMITTED,
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

    // Not "Your revision note": the record is identical, only the note card's
    // title tracks who is reading it.
    await expect(
      page.getByRole('heading', { name: "Author's revision note" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(AUTHOR_NOTE)).toBeVisible();
    await expect(page.getByText(FIRST_REQUEST_COMMENT)).toBeVisible();
  });

  test("a decision admin sees the author's note", async ({
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
      state: ProposalReviewRequestState.RESUBMITTED,
    });

    await authenticatedPage.goto(
      proposalUrl(
        scenario.instance.slug,
        scenario.proposal.profileId,
        scenario.revisionRequest.id,
      ),
    );

    await expect(
      authenticatedPage.getByRole('heading', {
        name: "Author's revision note",
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      authenticatedPage.getByText(FIRST_REQUEST_COMMENT),
    ).toBeVisible();
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
      state: ProposalReviewRequestState.RESUBMITTED,
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

    // The panel must not render for a user with no access to the instance.
    await expect(
      page.getByRole('heading', { name: "Author's revision note" }),
    ).not.toBeVisible();
    await expect(page.getByText(FIRST_REQUEST_COMMENT)).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Review notes' }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Feedback' }),
    ).not.toBeVisible();
  });
});
