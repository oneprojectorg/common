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
const RESPONSE_COMMENT = 'I split the budget into staffing and equipment.';

const REVIEW_SCHEMA = {
  id: 'author-revision-note-schema',
  version: '1.0.0',
  name: 'Author Revision Note Schema',
  description:
    'Schema with a review-capable middle phase for the author-note test.',
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

// Minimal rubric — enough to keep the review page off its notFound() path when
// rubricTemplate is null. The test never touches it.
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

test.describe('Review — author revision note', () => {
  test('the requesting reviewer sees the note after the author resubmits', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `author-note-${testInfo.workerIndex}-${Date.now()}`;
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
    const { user: reviewer } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-reviewer`,
      instanceProfileId: instance.profileId,
    });

    await grantInstanceReviewerRole({
      instanceProfileId: instance.profileId,
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      roleName: `Reviewer-${testId}`,
    });

    // The reviewer's own request, already answered by the author — the state a
    // resubmission leaves behind (request RESUBMITTED, assignment back in the
    // reviewer's queue).
    const { assignment, revisionRequest } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: 'Community Solar Initiative',
        collaborationDocId: 'test-proposal-view-doc',
      },
      assignmentStatus: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
      revisionRequest: {
        state: ProposalReviewRequestState.RESUBMITTED,
        requestComment: REQUEST_COMMENT,
        responseComment: RESPONSE_COMMENT,
        respondedAt: new Date().toISOString(),
      },
    });

    if (!revisionRequest) {
      throw new Error('createReviewScenario did not return a revision request');
    }

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: reviewer.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`);

    // The note and the resubmission date render even though no request is open
    // any more — they hang off the assignment's own latest request.
    await expect(page.getByText("Author's note")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(RESPONSE_COMMENT)).toBeVisible();
    await expect(page.getByText('Revised on').first()).toBeVisible();

    // The link still opens the original request behind the note.
    await page.getByRole('button', { name: 'View revision request' }).click();

    const modal = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole('heading', { name: 'Revision request' }),
    ).toBeVisible();
    await expect(modal.getByText(REQUEST_COMMENT)).toBeVisible();

    // An answered request can no longer be cancelled.
    await expect(
      modal.getByRole('button', { name: 'Cancel request' }),
    ).toHaveCount(0);
  });
});
