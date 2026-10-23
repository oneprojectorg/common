import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  createCustomForm,
  createDecisionInstance,
  createReviewScenario,
  getSeededTemplate,
} from '@op/common/testing/data';
import { customFormSubmissions, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';

import { expect, test } from '../fixtures/index.js';

const REVIEW_SCHEMA = {
  id: 'review-custom-form-e2e',
  version: '1.0.0',
  name: 'Review Custom Form E2E',
  description: 'Schema for the review phase custom form e2e test.',
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
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'review',
      name: 'Review',
      rules: {
        proposals: { submit: false, review: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

// No required criteria, so the rubric is valid as soon as it renders.
const RUBRIC_TEMPLATE = {
  type: 'object',
  'x-field-order': ['feedback'],
  properties: {
    feedback: {
      type: 'string',
      title: 'Feedback',
      'x-format': 'long-text',
    },
  },
} as const satisfies RubricTemplateSchema;

const FORM_TITLE = 'Reviewer check-in';

const REVIEW_PHASE_FORM_SCHEMA = {
  type: 'object',
  title: FORM_TITLE,
  'x-phase': 'review',
  'x-field-order': ['conflicts'],
  required: ['conflicts'],
  properties: {
    conflicts: {
      type: 'string',
      title: 'Do you have a conflict of interest with any proposal?',
      'x-format': 'long-text',
    },
  },
};

test.describe('Review phase custom form', () => {
  test('asks for the review phase form on the first review submit only', async ({
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

    const author = {
      profileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    };
    const reviewer = { profileId: org.adminUser.profileId };
    const [first, second] = await Promise.all(
      ['Community Solar Initiative', 'Neighborhood Tool Library'].map((title) =>
        createReviewScenario({
          instance: { id: instance.instance.id },
          author,
          reviewer,
          proposalData: {
            title,
            collaborationDocId: 'test-proposal-view-doc',
          },
        }),
      ),
    );
    if (!first || !second) {
      throw new Error('Failed to seed review assignments');
    }

    const form = await createCustomForm({
      profileId: instance.profileId,
      schema: REVIEW_PHASE_FORM_SCHEMA,
    });

    const submitReview = page.getByRole('button', { name: 'Submit review' });
    const formDialog = page.getByRole('dialog', { name: FORM_TITLE });
    const submittedToast = page
      .locator('[data-slot="toast"]')
      .filter({ hasText: 'Review submitted successfully' });

    const listAnswers = () =>
      db
        .select()
        .from(customFormSubmissions)
        .where(eq(customFormSubmissions.customFormId, form.id));

    const openReview = async (assignmentId: string) => {
      await page.goto(
        `/en/decisions/${instance.slug}/reviews/${assignmentId}`,
        { waitUntil: 'domcontentloaded' },
      );
      await expect(submitReview).toBeEnabled({ timeout: 36_000 });
    };

    // First review: the form opens before the review is sent.
    await openReview(first.assignment.id);
    await page.screenshot({
      path: test.info().outputPath('01-review-before-submit.png'),
    });

    const conflictsField = formDialog.getByRole('textbox', {
      name: 'Do you have a conflict of interest with any proposal?',
    });

    await submitReview.click();
    await expect(conflictsField).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('02-review-phase-form.png'),
      animations: 'disabled',
    });

    // Closing the form cancels the submit.
    await page.keyboard.press('Escape');
    await expect(formDialog).toBeHidden();
    await expect(submitReview).toBeEnabled();
    expect(page.url()).toContain(`/reviews/${first.assignment.id}`);
    expect(await listAnswers()).toHaveLength(0);

    await submitReview.click();
    await conflictsField.fill('No conflicts.');
    await page.screenshot({
      path: test.info().outputPath('03-review-phase-form-filled.png'),
      animations: 'disabled',
    });
    await formDialog.getByRole('button', { name: 'Submit review' }).click();

    await expect(submittedToast).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/decisions\/[^/]+\/current$/, {
      timeout: 10_000,
    });
    await expect(page.getByText('Proposals to review').first()).toBeVisible({
      timeout: 36_000,
    });
    await page.screenshot({
      path: test.info().outputPath('04-first-review-submitted.png'),
    });

    const answers = await listAnswers();
    expect(answers).toHaveLength(1);
    expect(answers[0]?.profileId).toBe(org.adminUser.profileId);

    // Second review in the same phase: the form was answered, so it is not
    // asked again.
    // Drop the persisted query cache so the second review loads cold.
    await page.evaluate(() =>
      window.localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE'),
    );
    await openReview(second.assignment.id);
    await submitReview.click();
    await expect(submittedToast).toBeVisible({ timeout: 10_000 });
    await expect(formDialog).toBeHidden();
    expect(await listAnswers()).toHaveLength(1);
    await expect(page.getByText('Proposals to review').first()).toBeVisible({
      timeout: 36_000,
    });
    await page.screenshot({
      path: test.info().outputPath('05-second-review-no-form.png'),
    });
  });
});
