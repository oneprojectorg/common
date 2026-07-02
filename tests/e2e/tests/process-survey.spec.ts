import type { DecisionSchemaDefinition } from '@op/common';
import { decisionProcessSurveyResponses } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { createDecisionInstance, getSeededTemplate } from '@op/test';

import { expect, test } from '../fixtures/index.js';

/** Single last-phase schema with submit/review/voting all disabled. Because the
 *  current phase is index 0, resolveManualSelectionStatus returns
 *  selectionsAreConfirmed=true, so `/current` lands directly on ResultsPage —
 *  which mounts the post-vote NPS survey modal without any UI driving. */
const resultsOnlySchema: DecisionSchemaDefinition = {
  id: 'test-process-survey',
  version: '1.0.0',
  name: 'Process Survey Test Schema',
  description: 'Single results phase so ResultsPage (and the survey) mounts.',
  phases: [
    {
      id: 'results',
      name: 'Results',
      rules: {
        proposals: { submit: false, review: false },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
    },
  ],
};

test.describe('Process survey modal', () => {
  test('submits the NPS survey including the optional "anything else" field', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: resultsOnlySchema,
    });

    await authenticatedPage.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'networkidle',
    });

    // The survey modal opens once getProcessSurveyResponse resolves
    // hasResponded=false for this freshly-authenticated, never-submitted user.
    const dialog = authenticatedPage.getByRole('dialog');
    await expect(dialog.getByText('Your voice shapes Common.')).toBeVisible({
      timeout: 15_000,
    });

    await dialog.getByRole('radio', { name: 'No', exact: true }).click();

    // Desktop viewport renders the NPS scale as a RadioGroup (0-10). Score 9
    // puts the respondent in the promoter cohort, which requires a reason.
    await dialog.getByRole('radio', { name: '9', exact: true }).click();

    // Reason labels are shuffled on mount, so select by accessible name.
    await dialog
      .getByRole('checkbox', { name: 'I had no technical issues' })
      .click();

    const comments = 'The public results page could show a timeline.';
    await dialog
      .getByRole('textbox', { name: "Anything else you'd like to share?" })
      .fill(comments);

    await dialog.getByRole('button', { name: 'Submit & view results' }).click();

    // On success the modal primes the response cache and closes.
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    const [response] = await db
      .select({ internalData: decisionProcessSurveyResponses.internalData })
      .from(decisionProcessSurveyResponses)
      .where(
        eq(
          decisionProcessSurveyResponses.processInstanceId,
          instance.instance.id,
        ),
      )
      .limit(1);

    expect(response?.internalData).toMatchObject({
      wasAdmin: false,
      npsScore: 9,
      additionalComments: comments,
    });
  });
});
