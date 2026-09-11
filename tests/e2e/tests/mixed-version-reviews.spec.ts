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

// Inlined from @op/common/client: loading it in the e2e runner breaks on
// CJS/ESM interop.
const OVERALL_RECOMMENDATION_KEY = '__overall_recommendation';

/**
 * Submission → Review → Voting, every transition manual. `limit: 0` on review
 * makes review→voting pass nothing, the empty inbound transition that sends an
 * admin to the selection screen.
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

/**
 * The revised proposal's title before and after the revision. Only the pane
 * that renders proposal data shows the revised one — `reviseProposal` rewrites
 * `proposals.proposal_data`, not the `profiles` row the tables read by name.
 */
const ORIGINAL_TITLE = 'Riverside Crosswalk';
const REVISED_TITLE = 'Riverside Crosswalk and Lighting';
const UNTOUCHED_TITLE = 'Library Book Drive';

type SeedOrg = {
  organizationProfile: { id: string };
  adminUser: { authUserId: string; email: string };
};

/**
 * Two proposals in the review phase's pool: one revised after its first review
 * came in (so one stale review, one against the new version) and one never
 * revised. `stopOn` picks the phase the instance is parked on; the phase is
 * written last so no page read can cache an earlier state.
 */
async function seedMixedVersionReviews({
  org,
  supabaseAdmin,
  testId,
  stopOn,
}: {
  org: SeedOrg;
  supabaseAdmin: Parameters<typeof createInstanceMember>[0]['supabaseAdmin'];
  testId: string;
  stopOn: 'review' | 'voting';
}) {
  const template = await getSeededTemplate();

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: REVIEW_TO_VOTING_SCHEMA,
  });

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

  // The proposal that gets revised: two reviewers anchored to the
  // pre-revision snapshot, only one of whom re-reviews afterwards.
  const {
    proposal: revised,
    assignedProposalHistoryId: revisedFirstHistoryId,
    assignment: earlyAssignment,
  } = await createReviewScenario({
    instance: { id: instance.instance.id },
    author,
    reviewer: { profileId: earlyReviewer.profileId },
    proposalData: { title: ORIGINAL_TITLE },
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
      transitionedAt: new Date(Date.now() - 60_000),
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

  // The revision leaves the early review anchored to an older version.
  const revisedCurrentHistoryId = await reviseProposal({
    proposalId: revised.id,
    proposalData: { title: REVISED_TITLE },
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

  // `resolveManualSelectionStatus` reads an inbound transition with no
  // attachments and no manualSelection stamp as "awaiting a selection".
  if (stopOn === 'voting') {
    await db.insert(stateTransitionHistory).values({
      processInstanceId: instance.instance.id,
      fromStateId: 'review',
      toStateId: 'voting',
      transitionData: {},
      transitionedAt: new Date(),
    });
  }

  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...(instance.instance.instanceData as Record<string, unknown>),
        rubricTemplate: RUBRIC_TEMPLATE,
      },
      currentStateId: stopOn,
    })
    .where(eq(processInstances.id, instance.instance.id));

  return { instance, revised, untouched };
}

test.describe('Mixed version reviews — admin tags and banner', () => {
  test('the review summary banners the stale count and tags the stale reviewer row', async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const { instance, revised, untouched } = await seedMixedVersionReviews({
      org,
      supabaseAdmin,
      testId: `mixed-version-summary-${testInfo.workerIndex}-${Date.now()}`,
      stopOn: 'review',
    });

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

    // Only the left pane renders the proposal title as a heading, so the
    // headings below are enough to say which version is on screen.
    await expect(
      page.getByRole('heading', { name: REVISED_TITLE }),
    ).toBeVisible();

    // The reviewers are seeded without display names, so the badge's name is
    // read off the row that opens it rather than hardcoded.
    const staleRowLabel = await staleRow.getAttribute('aria-label');
    const staleReviewerName = (staleRowLabel ?? '')
      .replace(/^View review by /, '')
      .replace(/ \(older version\)$/, '');
    expect(staleReviewerName).not.toBe('');

    await staleRow.click();

    await expect(
      page.getByText(`Older version reviewed by ${staleReviewerName}`),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: ORIGINAL_TITLE }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: REVISED_TITLE }),
    ).toHaveCount(0);

    // The seeded proposal carries a collaboration doc that was never
    // version-stamped, so the body of that version cannot be rebuilt.
    await expect(page.getByText('Content could not be loaded')).toBeVisible();

    await page.getByRole('button', { name: 'Back to all reviewers' }).click();

    await expect(
      page.getByRole('heading', { name: REVISED_TITLE }),
    ).toBeVisible();
    await expect(page.getByText('Older version reviewed by')).toHaveCount(0);

    // An up-to-date review leaves the pane on the current proposal.
    await currentRow.click();
    await expect(
      page.getByRole('heading', { name: REVISED_TITLE }),
    ).toBeVisible();
    await expect(page.getByText('Older version reviewed by')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to all reviewers' }).click();

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
  });

  test('the selection table tags only the proposal with mixed-version reviews', async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const { instance } = await seedMixedVersionReviews({
      org,
      supabaseAdmin,
      testId: `mixed-version-table-${testInfo.workerIndex}-${Date.now()}`,
      stopOn: 'voting',
    });

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'networkidle',
    });

    await expect(
      page.getByRole('columnheader', { name: 'Overall recommendation' }),
    ).toBeVisible({ timeout: 36_000 });

    const revisedRow = page
      .getByRole('row')
      .filter({ hasText: ORIGINAL_TITLE });
    await expect(revisedRow).toContainText('Mixed version reviews');

    const untouchedRow = page
      .getByRole('row')
      .filter({ hasText: UNTOUCHED_TITLE });
    await expect(untouchedRow).toBeVisible();
    await expect(untouchedRow).not.toContainText('Mixed version reviews');
  });
});
