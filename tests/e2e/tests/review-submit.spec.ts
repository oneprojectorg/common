import type { RubricTemplateSchema } from '@op/common';
import { ProposalStatus, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createProposal,
  createProposalHistorySnapshot,
  createReviewAssignment,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Rubric template with three criterion types:
 *  - innovation: scored integer dropdown (1–5)
 *  - compliance: yes/no toggle
 *  - feedback:   long-text textarea
 *
 * All three are required so the submit button stays disabled until every
 * criterion has a value.
 */
const RUBRIC_TEMPLATE = {
  type: 'object',
  required: ['innovation', 'compliance', 'feedback'],
  'x-field-order': ['innovation', 'compliance', 'feedback'],
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
    feedback: {
      type: 'string',
      title: 'Qualitative Feedback',
      description: 'Provide written feedback on the proposal.',
      'x-format': 'long-text',
      minLength: 1,
    },
  },
} as const satisfies RubricTemplateSchema;

test.describe('Review Submit', () => {
  test('reviewer can fill rubric form and submit review', async ({
    authenticatedPage,
    org,
  }) => {
    // -- Setup ---------------------------------------------------------------

    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // Inject rubricTemplate into instanceData and set current phase to "review"
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

    // Create a submitted proposal for the reviewer to evaluate
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Proposal Under Review',
        collaborationDocId: 'test-proposal-doc',
      },
      status: ProposalStatus.SUBMITTED,
    });

    // History snapshot is needed by the review assignment lookup
    await createProposalHistorySnapshot({ proposalId: proposal.id });

    // Assign the authenticated user as the reviewer
    const assignment = await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: proposal.id,
      reviewerProfileId: org.adminUser.profileId,
    });

    // Small delay for DB propagation
    await new Promise((resolve) => setTimeout(resolve, 600));

    // -- Navigate to review page ---------------------------------------------

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/reviews/${assignment.id}`,
      { waitUntil: 'domcontentloaded' },
    );

    // Verify the rubric form rendered (heading appears in both desktop and
    // mobile layouts — pick the first visible one).
    await expect(
      authenticatedPage.getByText('Review Proposal', { exact: true }).first(),
    ).toBeVisible({ timeout: 36_000 });

    const submitButton = authenticatedPage.getByRole('button', {
      name: 'Submit review',
    });
    await expect(submitButton).toBeVisible();

    // Submit should be disabled — no criteria filled yet
    await expect(submitButton).toBeDisabled();

    // -- Open "Request revision" modal then cancel ----------------------------

    const requestRevisionButton = authenticatedPage.getByRole('button', {
      name: 'Request revision',
    });
    await requestRevisionButton.click();

    // Modal should be visible with its header and form
    const revisionModal = authenticatedPage.getByRole('dialog');
    await expect(revisionModal).toBeVisible();
    await expect(
      revisionModal.getByRole('heading', { name: 'Request revision' }),
    ).toBeVisible();
    await expect(
      revisionModal.getByText('Feedback for proposal author'),
    ).toBeVisible();

    // The submit button inside the modal should be disabled (empty comment)
    const modalSubmitButton = revisionModal.getByRole('button', {
      name: 'Request revision',
    });
    await expect(modalSubmitButton).toBeDisabled();

    // Type a comment — button should become enabled
    const commentTextarea = revisionModal.getByRole('textbox', {
      name: 'Feedback for proposal author',
    });
    await commentTextarea.fill('Please add more detail to the budget section.');
    await expect(modalSubmitButton).toBeEnabled();

    // Cancel instead of submitting
    await revisionModal.getByRole('button', { name: 'Cancel' }).click();
    await expect(revisionModal).toBeHidden();

    // -- Fill in scored criterion (Innovation) --------------------------------

    const innovationSelect = authenticatedPage.getByRole('button', {
      name: 'Innovation',
    });
    await innovationSelect.click();
    await authenticatedPage
      .getByRole('option', { name: '4 — Very Good' })
      .click();

    // -- Fill in yes/no criterion (Compliance) --------------------------------

    // The yes/no toggle has no accessible name — locate via its parent section.
    const complianceSection = authenticatedPage
      .locator('section')
      .filter({ hasText: 'Compliance' });
    await complianceSection.getByRole('button').click();

    // -- Fill in long-text criterion (Qualitative Feedback) -------------------

    const feedbackTextarea = authenticatedPage.getByRole('textbox', {
      name: 'Qualitative Feedback',
    });
    await feedbackTextarea.fill('The proposal is well-structured and feasible.');

    // -- Verify total score updated -------------------------------------------

    // Only "Innovation" contributes to the score (integer criterion = 4 pts).
    // The component renders in both desktop and mobile layouts — use .first().
    const totalScoreContainer = authenticatedPage
      .getByText('Total Score')
      .first()
      .locator('..');
    await expect(
      totalScoreContainer.locator('span').filter({ hasText: /^4$/ }),
    ).toBeVisible();

    // -- Submit the review ----------------------------------------------------

    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // -- Assert success -------------------------------------------------------

    // Success toast
    const successToast = authenticatedPage
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Review submitted successfully' });
    await expect(successToast).toBeVisible({ timeout: 10_000 });

    // Redirected back to the decision page
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/decisions/${instance.slug}`),
      { timeout: 10_000 },
    );
  });
});
