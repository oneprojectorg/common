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

/**
 * Queue cards open the proposal-keyed review URL, which resolves per viewer —
 * the assignee's own review screen here, the review-progress screen for an
 * instance admin. (The assignment-keyed `/reviews/[assignmentId]` URL still
 * exists for email links; it is just no longer what a card links to.)
 */
const PROPOSAL_REVIEWS_URL = /\/proposal\/[^/]+\/reviews$/;

test.describe('Review Submit', () => {
  test('full review journey: request revision → cancel → submit review → edit review', async ({
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

    const { assignment } = await createReviewScenario({
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

    const decisionUrl = `/en/decisions/${instance.slug}/current`;
    // The fixture's reviewer is also the instance admin, so the proposal-keyed
    // URL a queue card links to resolves to Review Progress for them (asserted
    // in step 2). The assignment-keyed URL is the reviewer surface, so the
    // review-form steps below enter through it.
    const reviewUrl = `/en/decisions/${instance.slug}/reviews/${assignment.id}`;
    // Each entry is a cold load, so drop the persisted React Query cache first —
    // otherwise the form can initialise from the pre-mutation snapshot written
    // earlier in this session (an empty rubric after the review was submitted).
    const openReview = async () => {
      await page.evaluate(() =>
        window.localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE'),
      );
      await page.goto(reviewUrl, { waitUntil: 'domcontentloaded' });
    };

    /** Locate the status badge <span> on the assignments list. */
    const statusBadge = page.locator('span').filter({
      hasText:
        /^(Not Started|In Progress|Completed|Revision Requested|Needs Review)$/,
    });

    // ========================================================================
    // Step 1: Decision page — assignments list shows "Not Started"
    // ========================================================================

    await page.goto(decisionUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Proposals to review').first()).toBeVisible({
      timeout: 36_000,
    });
    await expect(page.getByText(PROPOSAL_TITLE).first()).toBeVisible();
    await expect(statusBadge).toHaveText('Not Started');

    // ========================================================================
    // Step 2: Card opens the proposal-keyed URL; request a revision
    // ========================================================================

    await page.getByText(PROPOSAL_TITLE).first().click();
    await expect(page).toHaveURL(PROPOSAL_REVIEWS_URL, { timeout: 10_000 });
    // Admin resolution of that URL.
    await expect(
      page.getByRole('heading', { name: 'Review Progress' }),
    ).toBeVisible({ timeout: 36_000 });

    // Being the assignee too, they get "+ Add review" below the reviewer list.
    // It swaps their own form into the panel without leaving the screen.
    const progressUrl = page.url();
    await page.getByRole('button', { name: '+ Add review' }).click();
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toBe(progressUrl);

    // Revisions belong to the reviewer surface, so the rest of the journey runs
    // on the standalone review screen.
    await page.getByRole('button', { name: 'Back to all reviewers' }).click();
    await openReview();
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    await page.getByRole('button', { name: 'Request revision' }).click();

    const requestModal = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
    await expect(requestModal).toBeVisible();

    await requestModal
      .getByRole('textbox', { name: 'Feedback for proposal author' })
      .fill('Please add more detail to the budget section.');

    await requestModal
      .getByRole('button', { name: 'Request revision' })
      .click();

    await expect(
      page
        .locator('[data-slot="toast"]')
        .filter({ hasText: 'Revision requested' }),
    ).toBeVisible({ timeout: 10_000 });

    // ========================================================================
    // Step 3: Back to list — status is "Revision Requested"
    // ========================================================================

    await page.getByText('Back to proposals').click();
    await expect(page).toHaveURL(new RegExp(decisionUrl), { timeout: 10_000 });

    await expect(page.getByText('Proposals to review').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(statusBadge).toHaveText('Revision Requested');

    // ========================================================================
    // Step 4: Back into the review and cancel the revision
    // ========================================================================

    await openReview();
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    // While a request is active, the navbar "Request revision" button is
    // hidden and the rubric pane's alert banner exposes "View feedback".
    await page.getByRole('button', { name: 'View feedback' }).click();

    const viewModal = page
      .getByRole('dialog')
      .and(page.locator(':not([data-slot="toast"])'));
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
        .locator('[data-slot="toast"]')
        .filter({ hasText: 'Revision request cancelled' }),
    ).toBeVisible({ timeout: 10_000 });

    // ========================================================================
    // Step 5: Back to list — status is "In Progress"
    // ========================================================================

    await page.getByText('Back to proposals').click();
    await expect(page).toHaveURL(new RegExp(decisionUrl), { timeout: 10_000 });

    await expect(page.getByText('Proposals to review').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(statusBadge).toHaveText('In Progress');

    // ========================================================================
    // Step 6: Back into the review, fill rubric, and submit
    // ========================================================================

    await openReview();
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    const submitButton = page.getByRole('button', { name: 'Submit review' });
    await expect(submitButton).toBeDisabled();

    // Fill first required criterion: Innovation (scored, 4 pts). The scored
    // scale is a sense Select, so its trigger is a combobox, not a button.
    await page.getByRole('combobox', { name: 'Innovation' }).click();
    await page.getByRole('option', { name: '4 — Very Good' }).click();

    // Fill Innovation's optional rationale. The textarea is collapsed behind
    // an "Add Note" button per criterion, so open it first, then scope by
    // section because every criterion renders an identical "Notes" textarea.
    const innovationRationale =
      'Highly novel approach — reuses open patterns well.';
    const innovationSection = page
      .locator('section')
      .filter({ hasText: 'Innovation' });
    await innovationSection.getByRole('button', { name: 'Add Note' }).click();
    await innovationSection
      .getByRole('textbox', { name: 'Note' })
      .fill(innovationRationale);

    // Still disabled — two more required criteria (Feasibility, Compliance)
    await expect(submitButton).toBeDisabled();

    // Fill second required criterion: Feasibility (scored, 2 pts)
    await page.getByRole('combobox', { name: 'Feasibility' }).click();
    await page.getByRole('option', { name: '2 — Possible' }).click();

    // Still disabled — Compliance is still missing
    await expect(submitButton).toBeDisabled();

    // Fill third required criterion: Compliance (yes/no). Anchor by the heading
    // and pick the switch within that section, since every criterion also renders
    // an "Add Note" button. The control is a sense Switch (role="switch" +
    // aria-checked).
    await page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { name: 'Compliance', level: 4 }),
      })
      .getByRole('switch')
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
    // Recommendation is excluded from scoring. Max = Innovation (5) +
    // Feasibility (3) = 8.
    const totalScoreContainer = page
      .getByText('Total Score')
      .first()
      .locator('..');
    await expect(
      totalScoreContainer.locator('span').filter({ hasText: /^6\/8$/ }),
    ).toBeVisible();

    await submitButton.click();

    await expect(
      page
        .locator('[data-slot="toast"]')
        .filter({ hasText: 'Review submitted successfully' }),
    ).toBeVisible({ timeout: 10_000 });

    // ========================================================================
    // Step 7: Redirected to list — status is "Completed"
    // ========================================================================

    // router.push may drop the locale prefix, so match just the slug
    await expect(page).toHaveURL(new RegExp(`/decisions/${instance.slug}`), {
      timeout: 10_000,
    });

    await expect(page.getByText('Proposals to review').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(PROPOSAL_TITLE)).toBeVisible();
    await expect(statusBadge).toHaveText('Completed');

    // Verify the rationale round-tripped to storage under the split shape.
    const storedReview = await db.query.proposalReviews.findFirst({
      where: { assignmentId: assignment.id },
    });
    expect(storedReview?.reviewData).toMatchObject({
      rationales: { innovation: innovationRationale },
    });
    const submittedAt = storedReview?.submittedAt;

    // ========================================================================
    // Step 8: Re-open the completed review, edit it, and update in place
    // ========================================================================

    await openReview();
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    // The submitted review renders read-only; the phase is still "review" so
    // the header offers "Edit review".
    const editButton = page.getByRole('button', { name: 'Edit review' });
    await expect(editButton).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Submit review' }),
    ).toHaveCount(0);

    await editButton.click();

    // Editing switches the pane back into the interactive form; the header
    // action becomes "Update review".
    const updateButton = page.getByRole('button', { name: 'Update review' });
    await expect(updateButton).toBeVisible();

    // Change the Overall Recommendation from Yes to No.
    const editRecGroup = page.getByRole('radiogroup', {
      name: 'Overall Recommendation',
    });
    await expect(editRecGroup).toBeVisible();
    await editRecGroup.getByText('No', { exact: true }).click();

    await updateButton.click();

    await expect(
      page
        .locator('[data-slot="toast"]')
        .filter({ hasText: 'Review updated successfully' }),
    ).toBeVisible({ timeout: 10_000 });

    // The edit overwrote the answer in place while preserving submittedAt.
    const editedReview = await db.query.proposalReviews.findFirst({
      where: { assignmentId: assignment.id },
    });
    expect(
      (editedReview?.reviewData as { answers: Record<string, unknown> })
        .answers[OVERALL_RECOMMENDATION_KEY],
    ).toBe('no');
    expect(editedReview?.submittedAt).toBe(submittedAt);
  });

  test('shows comments section on the review page in read-only mode', async ({
    authenticatedPage: page,
    org,
  }) => {
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

    const { assignment } = await createReviewScenario({
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

    // Straight to the reviewer surface — the queue card's link target is
    // covered by the full-journey test above.
    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    // The comments section header renders alongside the proposal — reviewers
    // can read but not post, so the empty-state copy omits the call to action
    // and no comment textbox is present.
    await expect(
      page.getByRole('heading', { name: /^Comments \(\d+\)$/ }),
    ).toBeVisible();
    // A cold page load leaves the streamed server copy of the proposal pane in
    // the DOM (hidden) alongside the hydrated one, so target the visible copy.
    await expect(
      page.getByText('No comments yet.').filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByText('Be the first to comment')).toHaveCount(0);
    await expect(page.getByPlaceholder(/^Comment( as |\.\.\.)/)).toHaveCount(0);
  });

  test('hides Request revision button when reviewsAllowRevisions is false', async ({
    authenticatedPage: page,
    org,
  }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: REVIEW_SCHEMA,
    });

    // Inject rubricTemplate, set current phase to "review", and disable
    // the reviewer's ability to request revisions on this instance.
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...(instance.instance.instanceData as Record<string, unknown>),
          rubricTemplate: RUBRIC_TEMPLATE,
          config: { reviewsAllowRevisions: false },
        },
        currentStateId: 'review',
      })
      .where(eq(processInstances.id, instance.instance.id));

    const { assignment } = await createReviewScenario({
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

    // Straight to the reviewer surface — the queue card's link target is
    // covered by the full-journey test above.
    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    // Submit review is the baseline navbar action — wait for it to confirm
    // the navbar has rendered before asserting the absence of the other.
    await expect(
      page.getByRole('button', { name: 'Submit review' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Request revision' }),
    ).toHaveCount(0);
  });

  test('header stays in viewport after scrolling the review pane', async ({
    authenticatedPage: page,
    org,
  }) => {
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

    const { assignment } = await createReviewScenario({
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

    await page.setViewportSize({ width: 390, height: 844 });

    // Straight to the reviewer surface — the queue card's link target is
    // covered by the full-journey test above.
    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('button', { name: 'Submit review' }),
    ).toBeVisible({ timeout: 36_000 });

    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLElement>('[role="tabpanel"]')
        .forEach((el) => {
          el.scrollTop = el.scrollHeight;
        });
    });

    // Safari could scroll the header off-screen when pane content overflowed
    await expect(
      page.getByRole('button', { name: 'Submit review' }),
    ).toBeInViewport();
  });
});
