import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import { ProposalReviewState, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createInstanceMember,
  createProposalReview,
  createReviewAssignment,
  createReviewScenario,
  getSeededTemplate,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

// Mirrors OVERALL_RECOMMENDATION_KEY from @op/common/client. Inlined to
// sidestep CJS/ESM interop when loading @op/common from the e2e runner.
const OVERALL_RECOMMENDATION_KEY = '__overall_recommendation';

const REVIEW_SCHEMA = {
  id: 'review-summary-e2e',
  version: '1.0.0',
  name: 'Review Summary E2E',
  description: 'Schema for the per-proposal review summary page e2e tests.',
  proposalTemplate: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: 'Proposal title',
        'x-format': 'short-text',
      },
    },
    'x-field-order': ['title'],
    required: ['title'],
  },
  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals.',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'review',
      name: 'Review',
      description: 'Reviewers evaluate proposals.',
      rules: {
        proposals: { submit: false, review: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'results',
      name: 'Results',
      description: 'Final results.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

/**
 * Two scored criteria + an overall recommendation. Total possible per
 * review = max(innovation) + max(feasibility) = 5 + 3 = 8.
 */
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

const PROPOSAL_TITLE = 'Community Solar Initiative';

test.describe('Review Summary page', () => {
  test('admin sees aggregated reviews grouped by recommendation, deep-link round-trips', async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `review-summary-${testInfo.workerIndex}-${Date.now()}`;
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: REVIEW_SCHEMA,
    });

    // Inject rubricTemplate and put the instance in the review phase.
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

    // Four reviewers — two "Yes" voters, one "Maybe", one unsubmitted (no
    // review row, just an assignment).
    const { user: reviewerYes1 } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-yes1`,
      instanceProfileId: instance.profileId,
    });
    const { user: reviewerYes2 } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-yes2`,
      instanceProfileId: instance.profileId,
    });
    const { user: reviewerMaybe } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-maybe`,
      instanceProfileId: instance.profileId,
    });
    const { user: reviewerUnsubmitted } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-unsubmitted`,
      instanceProfileId: instance.profileId,
    });

    // First reviewer + proposal in one go. createReviewScenario flips the
    // proposal to SUBMITTED, which fires the AFTER UPDATE trigger that
    // writes the proposalHistory row used as assignedProposalHistoryId.
    const {
      proposal,
      assignedProposalHistoryId,
      assignment: yes1Assignment,
    } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author: {
        profileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
      },
      reviewer: { profileId: reviewerYes1.profileId },
      proposalData: {
        title: PROPOSAL_TITLE,
        collaborationDocId: 'test-proposal-view-doc',
      },
    });

    // The other three assignments share the same proposalHistory snapshot.
    const yes2Assignment = await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: proposal.id,
      reviewerProfileId: reviewerYes2.profileId,
      assignedProposalHistoryId,
    });
    const maybeAssignment = await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: proposal.id,
      reviewerProfileId: reviewerMaybe.profileId,
      assignedProposalHistoryId,
    });
    await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: proposal.id,
      reviewerProfileId: reviewerUnsubmitted.profileId,
      assignedProposalHistoryId,
    });

    // Submitted reviews — Yes1: 8, Yes2: 7, Maybe: 4. Avg = (8+7+4)/3 = 6.333…
    // → formatted as "6.3". No two row scores collide with the average string.
    const submittedAt = new Date().toISOString();
    await createProposalReview({
      assignmentId: yes1Assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          innovation: 5,
          feasibility: 3,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: { innovation: 'Strong vision' },
      },
      submittedAt,
    });
    await createProposalReview({
      assignmentId: yes2Assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          innovation: 4,
          feasibility: 3,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: {},
      },
      submittedAt,
    });
    await createProposalReview({
      assignmentId: maybeAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          innovation: 2,
          feasibility: 2,
          [OVERALL_RECOMMENDATION_KEY]: 'maybe',
        },
        rationales: {},
      },
      submittedAt,
    });

    const summaryUrl = `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/reviews`;

    await page.goto(summaryUrl, { waitUntil: 'domcontentloaded' });

    // ====================================================================
    // Step 1: Header reflects submitted/total + Average Score
    // ====================================================================

    await expect(
      page.getByRole('heading', { name: 'Review Summary' }),
    ).toBeVisible({ timeout: 36_000 });

    await expect(
      page.getByText(
        '3 out of 4 reviewers submitted a review for this proposal',
      ),
    ).toBeVisible();

    const averageScoreSection = page
      .getByText('Average Score', { exact: true })
      .locator('..');
    await expect(averageScoreSection).toContainText('6.3');
    await expect(averageScoreSection).toContainText('/8pts');

    // ====================================================================
    // Step 2: Recommendation groups — Yes (2), Maybe (1); No is filtered out
    // ====================================================================

    await expect(page.getByText('Yes (2)')).toBeVisible();
    await expect(page.getByText('Maybe (1)')).toBeVisible();
    await expect(page.getByText(/^No \(\d+\)$/)).toHaveCount(0);

    // Submitted-only — the unsubmitted assignment must not surface as a row.
    // Three reviewer rows total (one per submitted review).
    const reviewerRows = page.getByRole('button', {
      name: /^View review by /,
    });
    await expect(reviewerRows).toHaveCount(3);

    // ====================================================================
    // Step 3: Click the top-scoring row (Yes1, 8/8pts) → ReviewerDetail mounts
    //          and the assignment ID is pushed into the URL
    // ====================================================================

    const yes1Row = reviewerRows.filter({ hasText: '8/8pts' });
    await expect(yes1Row).toHaveCount(1);
    await yes1Row.click();

    await expect(page).toHaveURL(
      new RegExp(`assignment=${yes1Assignment.id}`),
      { timeout: 10_000 },
    );

    await expect(
      page.getByRole('button', { name: 'Back to all reviewers' }),
    ).toBeVisible();
    // Detail header shows the score in parentheses; the list rows do not.
    await expect(page.getByText('(8/8pts)')).toBeVisible();
    // The submitted rubric content renders below the header.
    await expect(
      page.getByRole('heading', { name: 'Innovation' }),
    ).toBeVisible();

    // ====================================================================
    // Step 4: Back to all reviewers — assignment param drops, list returns
    // ====================================================================

    await page.getByRole('button', { name: 'Back to all reviewers' }).click();

    await expect(page).toHaveURL(
      (url) => !new URL(url).searchParams.has('assignment'),
      { timeout: 10_000 },
    );
    await expect(page.getByText('Yes (2)')).toBeVisible();

    // ====================================================================
    // Step 5: Deep link with ?assignment=<id> renders detail on first paint
    // ====================================================================

    await page.goto(`${summaryUrl}?assignment=${maybeAssignment.id}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.getByRole('button', { name: 'Back to all reviewers' }),
    ).toBeVisible({ timeout: 36_000 });
    // Streaming SSR leaves a hidden Suspense fallback (`<div hidden id="S:0">`)
    // alongside the live tabpanel until React finishes hydrating, so duplicates
    // of every text node are present briefly. `.first()` targets the visible copy.
    await expect(page.getByText('(4/8pts)').first()).toBeVisible();
    await expect(page.getByText('Maybe').first()).toBeVisible();

    // ====================================================================
    // Step 6: Navbar "Back" link returns to the decision page
    // ====================================================================

    await page.getByRole('link', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/decisions/${instance.slug}$`), {
      timeout: 10_000,
    });
  });

  test('non-admin member of the instance is forbidden from the summary page', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `review-summary-forbidden-${testInfo.workerIndex}-${Date.now()}`;
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

    const { proposal } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author: {
        profileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
      },
      // Reviewer == the org admin so we don't need a separate reviewer here.
      reviewer: { profileId: org.adminUser.profileId },
      proposalData: {
        title: PROPOSAL_TITLE,
        collaborationDocId: 'test-proposal-view-doc',
      },
    });

    // Member-level access: READ on decisions zone, no ADMIN. Page should
    // resolve `decisionProfile.processInstance.access.admin === false` and
    // call forbidden().
    const { user: member } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-member`,
      instanceProfileId: instance.profileId,
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: member.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/reviews`,
      { waitUntil: 'domcontentloaded' },
    );

    // The route lives under /decisions/[slug]/..., so Next.js resolves the
    // nearest forbidden.tsx — the decision-scoped one, not the root locale
    // one. Its copy is "You don't have access to this page".
    await expect(
      page.getByRole('heading', {
        name: "You don't have access to this page",
      }),
    ).toBeVisible({ timeout: 36_000 });

    await ctx.close();
  });
});
