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
  createRevisionRequest,
  getSeededTemplate,
  grantInstanceReviewerRole,
  reviseProposal,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

const OLDER_REQUEST_COMMENT = 'Please add a detailed budget breakdown.';
const NEWER_REQUEST_COMMENT = 'Please name the partner organisations.';
const OLDER_NOTE = 'Broke the budget out per site and per line item.';
const NEWER_NOTE = 'Added the partnership with the Riverside District Library.';

const REVIEW_SCHEMA = {
  id: 'author-notes-schema',
  version: '1.0.0',
  name: 'Author Notes Schema',
  description:
    'Schema with a review-capable middle phase for the author notes test.',
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

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

test.describe('Review — author notes accordion', () => {
  test('lists one note per resubmission, newest first, each linking to its own request', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `author-notes-${testInfo.workerIndex}-${Date.now()}`;
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

    const {
      proposal,
      assignedProposalHistoryId: olderHistoryId,
      assignment,
    } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: 'Community Solar Initiative',
        collaborationDocId: 'test-proposal-view-doc',
      },
      assignmentStatus: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });

    // The revision closes the submitted snapshot and opens a new one, so the
    // two resubmissions have distinct versions to point at.
    const newerHistoryId = await reviseProposal({ proposalId: proposal.id });

    // Each resubmission stamps the version it answered with.
    await createRevisionRequest({
      assignmentId: assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: OLDER_REQUEST_COMMENT,
      responseComment: OLDER_NOTE,
      respondedProposalHistoryId: olderHistoryId,
      respondedAt: daysAgo(5),
    });
    await createRevisionRequest({
      assignmentId: assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: NEWER_REQUEST_COMMENT,
      responseComment: NEWER_NOTE,
      respondedProposalHistoryId: newerHistoryId,
      respondedAt: daysAgo(1),
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: reviewer.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`);

    const notes = page.getByTestId('author-notes').first();
    await expect(notes).toBeVisible({ timeout: 30_000 });
    await expect(
      notes.getByRole('button', { name: 'Collapse author notes' }),
    ).toBeVisible();

    const entries = notes.getByTestId('author-note');
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText(NEWER_NOTE);
    await expect(entries.nth(1)).toContainText(OLDER_NOTE);

    await entries
      .nth(1)
      .getByRole('button', { name: 'View revision request' })
      .click();

    const modal = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(modal).toBeVisible();
    await expect(modal.getByText(OLDER_REQUEST_COMMENT)).toBeVisible();
    // The dialog shows the request that note answered, not the other one.
    await expect(modal.getByText(NEWER_REQUEST_COMMENT)).toHaveCount(0);
    // A past request is nobody's to cancel.
    await expect(
      modal.getByRole('button', { name: 'Cancel request' }),
    ).toHaveCount(0);
  });
});
