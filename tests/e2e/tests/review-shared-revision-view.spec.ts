import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  processInstances,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import type { CreateOrganizationResult } from '@op/test';
import {
  createDecisionInstance,
  createInstanceMember,
  createReviewAssignment,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';
import type { Browser, Page, TestInfo } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

const REQUEST_COMMENT = 'Please add a detailed budget breakdown.';

const REVIEW_SCHEMA = {
  id: 'shared-revision-view-schema',
  version: '1.0.0',
  name: 'Shared Revision View Schema',
  description:
    'Schema with a review-capable middle phase for the shared revision view test.',
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
        proposals: { submit: false, review: true },
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

// One required scored criterion — the smallest rubric an unblocked reviewer
// can actually fill and submit, which is what the first test asserts.
const RUBRIC_TEMPLATE = {
  type: 'object',
  required: ['innovation'],
  'x-field-order': ['innovation'],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      'x-format': 'dropdown',
      // `minimum`/`maximum` are what make this a scored criterion — without
      // them `inferCriterionType` returns undefined and no control renders.
      minimum: 1,
      maximum: 2,
      oneOf: [
        { const: 1, title: '1 — Poor' },
        { const: 2, title: '2 — Good' },
      ],
    },
  },
} as const satisfies RubricTemplateSchema;

/**
 * The visible copy of the review pane. The layout renders one copy per
 * breakpoint, so both are in the DOM and only one is on screen.
 */
function reviewPane(page: Page) {
  return page.locator('[data-slot="review-form"]').filter({ visible: true });
}

/** The rubric wrapper the form marks `inert` while a reviewer is paused. */
function pausedRubric(page: Page) {
  return reviewPane(page).locator('[data-slot="review-rubric"][inert]');
}

test.describe('Review — shared revision request view', () => {
  test("a second reviewer sees the open request, cannot cancel it, submits anyway, and leaves the owner's pause intact", async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const scenario = await setUpSharedRevisionScenario({
      org,
      supabaseAdmin,
      testInfo,
    });

    const pageB = await openAs(browser, scenario.reviewerB.email);
    await pageB.goto(
      `/en/decisions/${scenario.slug}/reviews/${scenario.reviewerBAssignmentId}`,
      { waitUntil: 'domcontentloaded' },
    );
    const paneB = reviewPane(pageB);

    // Reviewer B is told about reviewer A's open request, but is not paused by
    // it: the informational alert, not the owner's paused warning.
    await expect(
      paneB.getByText('Another reviewer requested a revision'),
    ).toBeVisible({ timeout: 36_000 });
    await expect(paneB.getByText('Proposal Revision Requested')).toHaveCount(0);

    // Polite, not sense `Alert`'s default assertive `role="alert"` — it can
    // arrive mid-rubric and must not cut off the current announcement.
    const infoAlert = paneB.getByRole('status');
    await expect(infoAlert).toHaveAttribute('aria-live', 'polite');
    await expect(infoAlert).toContainText(
      'Another reviewer asked the author to revise this proposal.',
    );

    await paneB.getByRole('button', { name: 'View feedback' }).click();

    const modal = pageB
      .getByRole('dialog')
      .and(pageB.locator(':not([data-slot="toast"])'));
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole('heading', { name: 'Revision request' }),
    ).toBeVisible();
    await expect(modal.getByText(REQUEST_COMMENT)).toBeVisible();

    // Ownership gate: Cancel is hidden because the request belongs to
    // reviewer A, not the current viewer.
    await expect(
      modal.getByRole('button', { name: 'Cancel request' }),
    ).toHaveCount(0);
    // Two controls close this dialog: the sense DialogContent's built-in
    // corner button and the explicit one in the footer. Assert the footer's.
    const closeButton = modal
      .locator('[data-slot="dialog-footer"]')
      .getByRole('button', { name: 'Close', exact: true });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(modal).toHaveCount(0);

    // Navbar's "Request revision" is hidden — first come, first served, so
    // reviewer B cannot race into a competing request while one is open.
    await expect(
      pageB.getByRole('button', { name: 'Request revision' }),
    ).toHaveCount(0);

    // The rubric is live: nothing is inert, and the review goes through.
    await expect(pausedRubric(pageB)).toHaveCount(0);

    const submitButton = pageB.getByRole('button', { name: 'Submit review' });
    await expect(submitButton).toBeDisabled();

    await paneB.getByRole('combobox', { name: 'Innovation' }).click();
    await pageB.getByRole('option', { name: '2 — Good' }).click();

    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(
      pageB
        .locator('[data-slot="toast"]')
        .filter({ hasText: 'Review submitted successfully' }),
    ).toBeVisible({ timeout: 10_000 });

    // B's submission is B's alone: it must not close A's request or move A's
    // assignment on. This is the invariant the frontend-only pause was hiding.
    const storedRequest = await db.query.proposalReviewRequests.findFirst({
      where: { id: scenario.revisionRequestId },
    });
    expect(storedRequest?.state).toBe(ProposalReviewRequestState.REQUESTED);

    const storedAssignmentA =
      await db.query.proposalReviewAssignments.findFirst({
        where: { id: scenario.reviewerAAssignmentId },
      });
    expect(storedAssignmentA?.status).toBe(
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    );

    // And reviewer A, opening their own assignment after B submitted, is still
    // paused: warning alert, inert rubric, disabled submit.
    const pageA = await openAs(browser, scenario.reviewerA.email);
    await pageA.goto(
      `/en/decisions/${scenario.slug}/reviews/${scenario.reviewerAAssignmentId}`,
      { waitUntil: 'domcontentloaded' },
    );
    const paneA = reviewPane(pageA);

    await expect(paneA.getByText('Proposal Revision Requested')).toBeVisible({
      timeout: 36_000,
    });
    await expect(
      paneA.getByText('Another reviewer requested a revision'),
    ).toHaveCount(0);
    await expect(pausedRubric(pageA)).toHaveCount(1);
    await expect(
      pageA.getByRole('button', { name: 'Submit review' }),
    ).toBeDisabled();
  });
});

/**
 * A decision in its review phase with one proposal, two reviewers each holding
 * their own assignment, and an open revision request owned by reviewer A.
 */
async function setUpSharedRevisionScenario({
  org,
  supabaseAdmin,
  testInfo,
}: {
  org: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
  testInfo: TestInfo;
}) {
  const testId = `shared-rev-${testInfo.workerIndex}-${Date.now()}`;
  const template = await getSeededTemplate();

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: REVIEW_SCHEMA,
  });

  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...(instance.instance.instanceData as Record<string, unknown>),
        rubricTemplate: RUBRIC_TEMPLATE,
      },
      currentStateId: 'review',
    })
    .where(eq(processInstances.id, instance.instance.id));

  const { user: author } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-author`,
    instanceProfileId: instance.profileId,
  });
  const { user: reviewerA } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-reviewer-a`,
    instanceProfileId: instance.profileId,
  });
  const { user: reviewerB } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-reviewer-b`,
    instanceProfileId: instance.profileId,
  });

  await grantInstanceReviewerRole({
    instanceProfileId: instance.profileId,
    authUserId: reviewerA.authUserId,
    email: reviewerA.email,
    roleName: `ReviewerA-${testId}`,
  });
  await grantInstanceReviewerRole({
    instanceProfileId: instance.profileId,
    authUserId: reviewerB.authUserId,
    email: reviewerB.email,
    roleName: `ReviewerB-${testId}`,
  });

  // Reviewer A owns the revision request.
  const {
    proposal,
    assignedProposalHistoryId,
    assignment: reviewerAAssignment,
    revisionRequest,
  } = await createReviewScenario({
    instance: { id: instance.instance.id },
    author,
    reviewer: { profileId: reviewerA.profileId },
    proposalData: {
      title: 'Community Solar Initiative',
      collaborationDocId: 'test-proposal-view-doc',
    },
    assignmentStatus: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    revisionRequest: {
      state: ProposalReviewRequestState.REQUESTED,
      requestComment: REQUEST_COMMENT,
    },
  });

  if (!revisionRequest) {
    throw new Error('createReviewScenario did not return a revision request');
  }

  // Reviewer B has their own assignment on the same proposal — no request.
  const reviewerBAssignment = await createReviewAssignment({
    processInstanceId: instance.instance.id,
    proposalId: proposal.id,
    reviewerProfileId: reviewerB.profileId,
    assignedProposalHistoryId,
  });

  return {
    slug: instance.slug,
    reviewerA,
    reviewerB,
    revisionRequestId: revisionRequest.id,
    reviewerAAssignmentId: reviewerAAssignment.id,
    reviewerBAssignmentId: reviewerBAssignment.id,
  };
}

async function openAs(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await authenticateAsUser(page, {
    email,
    password: TEST_USER_DEFAULT_PASSWORD,
  });
  return page;
}
