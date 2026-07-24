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

// Review phase (`proposals.review: true`) so the reviewer sees the tabs.
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

// Card titles come from the collab-doc fragment the e2e mock pre-seeds for these doc IDs.
const ASSIGNED_TITLE = 'Community Garden Project'; // test-proposal-listing-doc
const OTHER_TITLE = 'Youth Mentorship Program'; // test-proposal-listing-doc-alt

test.describe('Other proposals tab', () => {
  test("excludes the reviewer's assigned proposals and shows the rest", async ({
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
      .set({ currentStateId: 'review' })
      .where(eq(processInstances.id, instance.instance.id));

    const author = {
      profileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    };

    // Assigned to the reviewer → must be excluded from "Other proposals".
    await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: org.adminUser.profileId },
      proposalData: {
        title: ASSIGNED_TITLE,
        collaborationDocId: 'test-proposal-listing-doc',
      },
    });

    // Not assigned → the only proposal that should appear on "Other proposals".
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

    await new Promise((resolve) => setTimeout(resolve, 600));

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    const reviewTab = page.getByRole('tab', { name: 'Proposals to review' });
    const otherTab = page.getByRole('tab', { name: 'Other proposals' });
    await expect(reviewTab).toBeVisible({ timeout: 36_000 });
    await expect(otherTab).toBeVisible();

    await expect(page.getByText(ASSIGNED_TITLE).first()).toBeVisible({
      timeout: 36_000,
    });

    await otherTab.click();
    await expect(otherTab).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByText(OTHER_TITLE).first()).toBeVisible({
      timeout: 36_000,
    });
    await expect(page.getByText(ASSIGNED_TITLE)).toHaveCount(0);
  });
});
