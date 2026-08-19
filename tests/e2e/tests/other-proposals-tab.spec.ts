import type { DecisionSchemaDefinition } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalStatus,
  processInstances,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createInstanceMember,
  createProposal,
  createReviewAssignment,
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
  test("excludes the reviewer's assigned proposals and shows the rest with review counts", async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
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
    const otherProposal = await createProposal({
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

    // Somebody else finished a review on it: this caller is an admin as well as
    // a reviewer, so the "Other proposals" cards carry the same counts the
    // "Proposals in review" list shows — an admin needs no `openReviews`.
    const otherReviewer = await createInstanceMember({
      supabaseAdmin,
      testId: `other-proposals-reviewer-${Date.now()}`,
      organization: { id: org.organization.id },
      instanceProfileId: instance.profileId,
    });

    await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: otherProposal.id,
      reviewerProfileId: otherReviewer.user.profileId,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

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

    // The count, linked to the proposal's Review Progress screen. It is the
    // whole decoration these cards carry — the "Proposals in review" list shows
    // exactly the same thing.
    const reviewedCount = page
      .getByRole('link', { name: '1 Reviewed' })
      .first();
    await expect(reviewedCount).toBeVisible({ timeout: 36_000 });
    await expect(reviewedCount).toHaveAttribute(
      'href',
      new RegExp(
        `/decisions/${instance.slug}/proposal/${otherProposal.profileId}/reviews$`,
      ),
    );
  });
});
