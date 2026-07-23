import type { DecisionSchemaDefinition } from '@op/common';
import { ProposalStatus, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createProposal,
  createReviewScenario,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Schema with a review phase (`proposals.review: true`) so the
 * DecisionStateRouter renders the ReviewPage — which, for a reviewer, hosts the
 * "Proposals to review" and "Other proposals" tabs.
 */
const REVIEW_SCHEMA = {
  id: 'other-proposals-e2e',
  version: '1.0.0',
  name: 'Other Proposals E2E',
  description: 'Schema for the Other proposals tab e2e test.',
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
  ],
} satisfies DecisionSchemaDefinition;

// Titles rendered on proposal cards come from the collab-doc title fragment,
// which the e2e mock (@op/collab) pre-seeds for these well-known doc IDs.
const ASSIGNED_TITLE = 'Community Garden Project'; // test-proposal-listing-doc
const OTHER_TITLE = 'Youth Mentorship Program'; // test-proposal-listing-doc-alt

test.describe('Other proposals tab', () => {
  test("excludes the reviewer's assigned proposals and shows the rest", async ({
    authenticatedPage: page,
    org,
  }) => {
    // -- Setup: a decision in the review phase with two proposals ------------
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
      .set({ currentStateId: 'review' })
      .where(eq(processInstances.id, instance.instance.id));

    const author = {
      profileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    };

    // Proposal assigned to the current user for review — belongs on the
    // "Proposals to review" tab, and must be excluded from "Other proposals".
    await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: org.adminUser.profileId },
      proposalData: {
        title: ASSIGNED_TITLE,
        collaborationDocId: 'test-proposal-listing-doc',
      },
    });

    // A submitted proposal the user is NOT assigned to review — the only one
    // that should surface on the "Other proposals" tab.
    await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: author.profileId,
      authUserId: author.authUserId,
      email: author.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: OTHER_TITLE,
        collaborationDocId: 'test-proposal-listing-doc-alt',
      },
    });

    // History trigger settles before the page reads the list.
    await new Promise((resolve) => setTimeout(resolve, 600));

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    // -- Both tabs render for the reviewer -----------------------------------
    const reviewTab = page.getByRole('tab', { name: 'Proposals to review' });
    const otherTab = page.getByRole('tab', { name: 'Other proposals' });
    await expect(reviewTab).toBeVisible({ timeout: 36_000 });
    await expect(otherTab).toBeVisible();

    // Default tab lists the assigned proposal.
    await expect(page.getByText(ASSIGNED_TITLE).first()).toBeVisible({
      timeout: 36_000,
    });

    // -- Other proposals: assigned one gone, unassigned one present ----------
    await otherTab.click();
    await expect(otherTab).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByText(OTHER_TITLE).first()).toBeVisible({
      timeout: 36_000,
    });
    await expect(page.getByText(ASSIGNED_TITLE)).toHaveCount(0);
  });
});
