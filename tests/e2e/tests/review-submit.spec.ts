import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import { processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createReviewScenario,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

// Mirrors OVERALL_RECOMMENDATION_KEY from @op/common/client. Inlined to
// sidestep CJS/ESM interop when loading @op/common from the e2e runner.
const OVERALL_RECOMMENDATION_KEY = '__overall_recommendation';

/**
 * Schema with a review phase that has `proposals.review: true` so the
 * DecisionStateRouter renders the ReviewPage with the assignments list.
 */
const REVIEW_SCHEMA = {
  id: 'review-e2e',
  version: '1.0.0',
  name: 'Review E2E',
  description: 'Schema for review e2e tests.',
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
 * Rubric template with six criteria — four required and two optional.
 *
 * Required:
 *  - innovation:               scored integer dropdown (1–5)
 *  - compliance:               yes/no toggle
 *  - feasibility:              scored integer dropdown (1–3)
 *  - __overall_recommendation: horizontal radio group (Yes/Maybe/No)
 *
 * Optional:
 *  - feedback:    long-text textarea
 *  - methodology: string dropdown (multiple choice)
 *
 * This lets us verify that:
 *  - Submit is disabled until all *required* criteria are filled
 *  - Submit is enabled even when optional criteria are left empty
 *  - Total score sums only scored criteria that have values
 *  - Overall Recommendation renders as a radio group and is excluded
 *    from the total score
 */
const RUBRIC_TEMPLATE = {
  type: 'object',
  required: [
    'innovation',
    'compliance',
    'feasibility',
    OVERALL_RECOMMENDATION_KEY,
  ],
  'x-field-order': [
    'innovation',
    'feasibility',
    'compliance',
    'methodology',
    'feedback',
    OVERALL_RECOMMENDATION_KEY,
  ],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      description: 'How innovative is this proposal?',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: '1 — Poor' },
        { const: 2, title: '2 — Fair' },
        { const: 3, title: '3 — Good' },
        { const: 4, title: '4 — Very Good' },
        { const: 5, title: '5 — Excellent' },
      ],
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      description: 'How feasible is the proposed plan?',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 3,
      oneOf: [
        { const: 1, title: '1 — Unlikely' },
        { const: 2, title: '2 — Possible' },
        { const: 3, title: '3 — Very Likely' },
      ],
    },
    compliance: {
      type: 'string',
      title: 'Compliance',
      description: 'Does the proposal meet compliance requirements?',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
    methodology: {
      type: 'string',
      title: 'Methodology',
      description: 'What methodology does the proposal follow?',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'quantitative', title: 'Quantitative' },
        { const: 'qualitative', title: 'Qualitative' },
        { const: 'mixed', title: 'Mixed Methods' },
      ],
    },
    feedback: {
      type: 'string',
      title: 'Qualitative Feedback',
      description: 'Provide written feedback on the proposal.',
      'x-format': 'long-text',
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
 * The proposal title displayed on cards is resolved from the collab doc
 * fragment, not `proposalData.title`. The `test-proposal-view-doc` mock
 * returns 'Community Solar Initiative' for the title fragment.
 */
const PROPOSAL_TITLE = 'Community Solar Initiative';

test.describe('Review Submit', () => {
  test('full review journey: request revision → cancel → submit review', async ({
    authenticatedPage: page,
    org,
  }) => {
    // -- Setup: decision in review phase with one assignment ------------------

    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: REVIEW_SCHEMA,
    });

    // Inject rubricTemplate and set current phase to "review"
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

    await createReviewScenario({
      instance: { id: instance.instance.id },
      author: {
        profileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
      },
      reviewer: { profileId: org.adminUser.profileId },
      proposalData: {
        title: PROPOSAL_TITLE,
        collaborationDocId: 'test-proposal-view-doc',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    const decisionUrl = `/en/decisions/${instance.slug}`;

    /** Locate the status badge <span> on the assignments list. */
    const statusBadge = page.locator('span').filter({
      hasText:
        /^(Not Started|In Progress|Completed|Revision Requested|Needs Review)$/,
    });

    // ========================================================================
    // Step 1: Decision page — assignments list shows "Not Started"
    // ========================================================================

    await page.goto(decisionUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Proposals to review')).toBeVisible({
      timeout: 36_000,
    });
    await expect(page.getByText(PROPOSAL_TITLE).first()).toBeVisible();
    await expect(statusBadge).toHaveText('Not Started');

    // ========================================================================
    // Step 2: Click into review and request a revision
    // ========================================================================

    await page.getByText(PROPOSAL_TITLE).first().click();
    await expect(page).toHaveURL(/\/reviews\//, { timeout: 10_000 });
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    await page.getByRole('button', { name: 'Request revision' }).click();

    const requestModal = page.getByRole('dialog');
    await expect(requestModal).toBeVisible();

    await requestModal
      .getByRole('textbox', { name: 'Feedback for proposal author' })
      .fill('Please add more detail to the budget section.');

    await requestModal
      .getByRole('button', { name: 'Request revision' })
      .click();

    await expect(
      page
        .locator('[data-sonner-toast]')
        .filter({ hasText: 'Revision requested' }),
    ).toBeVisible({ timeout: 10_000 });

    // ========================================================================
    // Step 3: Back to list — status is "Revision Requested"
    // ========================================================================

    await page.getByText('Back to proposals').click();
    await expect(page).toHaveURL(new RegExp(decisionUrl), { timeout: 10_000 });

    await expect(page.getByText('Proposals to review')).toBeVisible({
      timeout: 10_000,
    });
    await expect(statusBadge).toHaveText('Revision Requested');

    // ========================================================================
    // Step 4: Click back into review and cancel the revision
    // ========================================================================

    await page.getByText(PROPOSAL_TITLE).first().click();
    await expect(page).toHaveURL(/\/reviews\//, { timeout: 10_000 });
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    // While a request is active, the navbar "Request revision" button is
    // hidden and the rubric pane's alert banner exposes "View feedback".
    await page.getByRole('button', { name: 'View feedback' }).click();

    const viewModal = page.getByRole('dialog');
    await expect(viewModal).toBeVisible();
    await expect(
      viewModal.getByRole('heading', { name: 'Revision request' }),
    ).toBeVisible();
    await expect(
      viewModal.getByText('Please add more detail to the budget section.'),
    ).toBeVisible();

    await viewModal.getByRole('button', { name: 'Cancel request' }).click();

    await expect(
      page
        .locator('[data-sonner-toast]')
        .filter({ hasText: 'Revision request cancelled' }),
    ).toBeVisible({ timeout: 10_000 });

    // ========================================================================
    // Step 5: Back to list — status is "In Progress"
    // ========================================================================

    await page.getByText('Back to proposals').click();
    await expect(page).toHaveURL(new RegExp(decisionUrl), { timeout: 10_000 });

    await expect(page.getByText('Proposals to review')).toBeVisible({
      timeout: 10_000,
    });
    await expect(statusBadge).toHaveText('In Progress');

    // ========================================================================
    // Step 6: Click back into review, fill rubric, and submit
    // ========================================================================

    await page.getByText(PROPOSAL_TITLE).first().click();
    await expect(page).toHaveURL(/\/reviews\//, { timeout: 10_000 });
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    const submitButton = page.getByRole('button', { name: 'Submit review' });
    await expect(submitButton).toBeDisabled();

    // Fill first required criterion: Innovation (scored, 4 pts)
    await page.getByRole('button', { name: 'Innovation' }).click();
    await page.getByRole('option', { name: '4 — Very Good' }).click();

    // Still disabled — two more required criteria (Feasibility, Compliance)
    await expect(submitButton).toBeDisabled();

    // Fill second required criterion: Feasibility (scored, 2 pts)
    await page.getByRole('button', { name: 'Feasibility' }).click();
    await page.getByRole('option', { name: '2 — Possible' }).click();

    // Still disabled — Compliance is still missing
    await expect(submitButton).toBeDisabled();

    // Fill third required criterion: Compliance (yes/no toggle)
    await page
      .locator('section')
      .filter({ hasText: 'Compliance' })
      .getByRole('button')
      .click();

    // Still disabled — Overall Recommendation is still missing
    await expect(submitButton).toBeDisabled();

    // Fill fourth required criterion: Overall Recommendation (horizontal
    // radio group with Yes/Maybe/No). React Aria renders the underlying
    // <input type="radio"> as sr-only, so click the visible label text.
    const overallRecGroup = page.getByRole('radiogroup', {
      name: 'Overall Recommendation',
    });
    await expect(overallRecGroup).toBeVisible();
    await overallRecGroup.getByText('Yes', { exact: true }).click();

    // All required criteria are filled — submit should be enabled even though
    // the optional criteria (Methodology, Qualitative Feedback) are empty.
    await expect(submitButton).toBeEnabled();

    // Total score = Innovation (4) + Feasibility (2) = 6. Overall
    // Recommendation is excluded from scoring.
    const totalScoreContainer = page
      .getByText('Total Score')
      .first()
      .locator('..');
    await expect(
      totalScoreContainer.locator('span').filter({ hasText: /^6$/ }),
    ).toBeVisible();

    await submitButton.click();

    await expect(
      page
        .locator('[data-sonner-toast]')
        .filter({ hasText: 'Review submitted successfully' }),
    ).toBeVisible({ timeout: 10_000 });

    // ========================================================================
    // Step 7: Redirected to list — status is "Completed"
    // ========================================================================

    // router.push may drop the locale prefix, so match just the slug
    await expect(page).toHaveURL(new RegExp(`/decisions/${instance.slug}`), {
      timeout: 10_000,
    });

    await expect(page.getByText('Proposals to review')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await expect(statusBadge).toHaveText('Completed');
  });
});
