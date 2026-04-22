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
import {
  createDecisionInstance,
  createInstanceMember,
  createReviewAssignment,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';

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

// Minimal rubric — just enough to unblock the review page's notFound() when
// rubricTemplate is null. We never interact with it.
const RUBRIC_TEMPLATE = {
  type: 'object',
  required: ['innovation'],
  'x-field-order': ['innovation'],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 1, title: '1' },
        { const: 2, title: '2' },
      ],
    },
  },
} as const satisfies RubricTemplateSchema;

test.describe('Review — shared revision request view', () => {
  test('a second reviewer sees the pending revision but cannot cancel it', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
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
    const { proposal, assignedProposalHistoryId, revisionRequest } =
      await createReviewScenario({
        instance: { id: instance.instance.id },
        author,
        reviewer: { profileId: reviewerA.profileId },
        proposalData: {
          title: 'Community Solar Initiative',
          collaborationDocId: 'test-proposal-view-doc',
        },
        assignmentStatus:
          ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
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

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: reviewerB.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(
      `/en/decisions/${instance.slug}/reviews/${reviewerBAssignment.id}`,
    );

    // Shared paused state — banner + "View feedback" affordance render for
    // reviewer B even though the request is on reviewer A's assignment.
    // ReviewLayout renders the rubric pane twice (desktop + mobile
    // responsive containers), so both copies exist in the DOM; pick the
    // first one — which is the desktop copy that's visible at Playwright's
    // default 1280px viewport.
    await expect(
      page.getByText('Proposal Revision Requested').first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: 'View feedback' }).first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'View feedback' }).first().click();

    const modal = page.getByRole('dialog');
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
    await expect(
      modal.getByRole('button', { name: 'Close', exact: true }),
    ).toBeVisible();

    // Navbar's "Request revision" is hidden too — reviewer B shouldn't race
    // into a duplicate request while one is already open.
    await expect(
      page.getByRole('button', { name: 'Request revision' }),
    ).toHaveCount(0);
  });
});
