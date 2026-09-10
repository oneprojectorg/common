import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  ProposalReviewState,
  decisionTransitionProposals,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createInstanceMember,
  createProposalReview,
  createReviewAssignment,
  createReviewScenario,
  getSeededTemplate,
  reviseProposal,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

// Mirrors OVERALL_RECOMMENDATION_KEY from @op/common/client. Inlined to
// sidestep CJS/ESM interop when loading @op/common from the e2e runner.
const OVERALL_RECOMMENDATION_KEY = '__overall_recommendation';

/**
 * Submission → Review (review enabled) → Voting, every transition manual.
 * `limit: 0` on review makes review→voting pass nothing, which is the empty
 * inbound transition ReviewSelectionPage exists to recover from.
 */
const REVIEW_TO_VOTING_SCHEMA: DecisionSchemaDefinition = {
  id: 'test-mixed-version-reviews',
  version: '1.0.0',
  name: 'Mixed Version Reviews Test Schema',
  description: 'Submission → Review → Voting for the admin staleness tags.',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    {
      id: 'review',
      name: 'Review & Shortlist',
      rules: {
        proposals: { submit: false, review: true },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'zero', type: 'limit', count: 0 }],
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'manual' },
      },
    },
  ],
};

/** Two scored criteria + an overall recommendation; 5 + 3 = 8 points per review. */
const RUBRIC_TEMPLATE = {
  type: 'object',
  required: ['innovation', 'feasibility', OVERALL_RECOMMENDATION_KEY],
  'x-field-order': ['innovation', 'feasibility', OVERALL_RECOMMENDATION_KEY],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: '1' },
        { const: 2, title: '2' },
        { const: 3, title: '3' },
        { const: 4, title: '4' },
        { const: 5, title: '5' },
      ],
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 3,
      oneOf: [
        { const: 1, title: '1' },
        { const: 2, title: '2' },
        { const: 3, title: '3' },
      ],
    },
    [OVERALL_RECOMMENDATION_KEY]: {
      type: 'string',
      title: 'Overall Recommendation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'maybe', title: 'Maybe' },
        { const: 'no', title: 'No' },
      ],
    },
  },
} as const satisfies RubricTemplateSchema;

const REVISED_TITLE = 'Riverside Crosswalk';
const UNTOUCHED_TITLE = 'Library Book Drive';

test.describe('Mixed version reviews — admin tags and banner', () => {
  test('a revision marks the proposal row, the summary banner and the stale reviewer row', async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `mixed-version-${testInfo.workerIndex}-${Date.now()}`;
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: REVIEW_TO_VOTING_SCHEMA,
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

    const { user: earlyReviewer } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-early`,
      instanceProfileId: instance.profileId,
    });
    const { user: lateReviewer } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-late`,
      instanceProfileId: instance.profileId,
    });

    const author = {
      profileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    };

    // The proposal that gets revised: two reviewers, both anchored to the
    // pre-revision snapshot, only one of whom re-reviews afterwards.
    const {
      proposal: revised,
      assignedProposalHistoryId: revisedFirstHistoryId,
      assignment: earlyAssignment,
    } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: earlyReviewer.profileId },
      proposalData: { title: REVISED_TITLE },
    });

    const lateAssignment = await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: revised.id,
      reviewerProfileId: lateReviewer.profileId,
      assignedProposalHistoryId: revisedFirstHistoryId,
    });

    // The control proposal: one review, never revised.
    const {
      proposal: untouched,
      assignedProposalHistoryId: untouchedHistoryId,
      assignment: untouchedAssignment,
    } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: earlyReviewer.profileId },
      proposalData: { title: UNTOUCHED_TITLE },
    });

    // Both proposals belong to the review phase's pool.
    const [submissionToReview] = await db
      .insert(stateTransitionHistory)
      .values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        transitionData: {},
      })
      .returning();
    if (!submissionToReview) {
      throw new Error('Failed to seed the submission→review transition');
    }

    await db.insert(decisionTransitionProposals).values([
      {
        processInstanceId: instance.instance.id,
        transitionHistoryId: submissionToReview.id,
        proposalId: revised.id,
        proposalHistoryId: revisedFirstHistoryId,
      },
      {
        processInstanceId: instance.instance.id,
        transitionHistoryId: submissionToReview.id,
        proposalId: untouched.id,
        proposalHistoryId: untouchedHistoryId,
      },
    ]);

    const submittedAt = new Date().toISOString();

    await createProposalReview({
      assignmentId: earlyAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          innovation: 5,
          feasibility: 3,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
      },
      submittedAt,
      reviewedProposalHistoryId: revisedFirstHistoryId,
    });

    await createProposalReview({
      assignmentId: untouchedAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          innovation: 4,
          feasibility: 3,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
      },
      submittedAt,
      reviewedProposalHistoryId: untouchedHistoryId,
    });

    // The revision: the early review's anchor stops matching the proposal's
    // current version, the late one is written against the new version.
    const revisedCurrentHistoryId = await reviseProposal({
      proposalId: revised.id,
    });

    await createProposalReview({
      assignmentId: lateAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          innovation: 4,
          feasibility: 3,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
      },
      submittedAt,
      reviewedProposalHistoryId: revisedCurrentHistoryId,
    });

    // ================================================================
    // 1. Proposal review summary: banner counts + per-reviewer tag
    // ================================================================

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${revised.profileId}/reviews`,
      { waitUntil: 'domcontentloaded' },
    );

    await expect(
      page.getByRole('heading', { name: 'Review Progress' }),
    ).toBeVisible({ timeout: 36_000 });

    const banner = page.getByRole('alert').filter({
      hasText: 'Mixed version reviews',
    });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(
      '1 out of 2 reviews were completed before the latest revision. Cumulative score includes all reviews.',
    );

    // 8/8 is the early (stale) review, 7/8 the late one.
    const staleRow = page.getByRole('button', {
      name: /^View review by .*\(older version\)$/,
    });
    await expect(staleRow).toHaveCount(1);
    await expect(staleRow).toContainText('8/8pts');
    await expect(staleRow).toContainText('Older version');

    const currentRow = page
      .getByRole('button', { name: /^View review by / })
      .filter({ hasText: '7/8pts' });
    await expect(currentRow).toHaveCount(1);
    await expect(currentRow).not.toContainText('Older version');

    // The untouched proposal keeps a clean summary.
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${untouched.profileId}/reviews`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      page.getByRole('heading', { name: 'Review Progress' }),
    ).toBeVisible({ timeout: 36_000 });
    await expect(page.getByText('Mixed version reviews')).toHaveCount(0);
    await expect(page.getByText('Older version')).toHaveCount(0);

    // ================================================================
    // 2. Advance to voting so the selection table renders
    // ================================================================

    await page.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: 'Advance' }).first().click();

    const advanceDialog = page
      .getByRole('alertdialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(advanceDialog).toBeVisible();
    await advanceDialog.getByRole('button', { name: 'Advance Phase' }).click();
    await expect(advanceDialog).not.toBeVisible({ timeout: 15_000 });

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'networkidle',
    });

    await expect(
      page.getByRole('columnheader', { name: 'Overall recommendation' }),
    ).toBeVisible({ timeout: 15_000 });

    // ================================================================
    // 3. Selection table: only the revised proposal carries the tag
    // ================================================================

    const revisedRow = page.getByRole('row').filter({ hasText: REVISED_TITLE });
    await expect(revisedRow).toContainText('Mixed version reviews');

    const untouchedRow = page
      .getByRole('row')
      .filter({ hasText: UNTOUCHED_TITLE });
    await expect(untouchedRow).not.toContainText('Mixed version reviews');
  });
});
