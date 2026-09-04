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
  createReviewScenario,
  getSeededTemplate,
  grantInstanceAdminWithoutReviewRole,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

// Review phase (`proposals.review: true`), the phase the review surface routes on.
const REVIEW_SCHEMA = {
  id: 'admin-review-progress-e2e',
  version: '1.0.0',
  name: 'Admin Review Progress E2E',
  description: 'Schema for the admin "Proposals in review" e2e test.',
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
const REVIEWED_TITLE = 'Community Garden Project'; // test-proposal-listing-doc
const UNREVIEWED_TITLE = 'Youth Mentorship Program'; // test-proposal-listing-doc-alt

test.describe('Admin review progress', () => {
  test('an admin without the review capability gets the single "Proposals in review" list', async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
  }) => {
    const template = await getSeededTemplate();

    // No admin access from the factory: the whole point of the test is a role
    // whose decisions bitfield omits REVIEW, and the seeded global Admin role
    // carries the profile ADMIN bit that would bypass it.
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: REVIEW_SCHEMA,
      grantAdminAccess: false,
    });

    await grantInstanceAdminWithoutReviewRole({
      instanceProfileId: instance.profileId,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
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

    // Somebody else does the reviewing — this admin holds no assignments, which
    // is exactly why the assignment queue has nothing to tab against.
    const reviewer = await createInstanceMember({
      supabaseAdmin,
      testId: `admin-review-progress-${Date.now()}`,
      organization: { id: org.organization.id },
      instanceProfileId: instance.profileId,
    });

    // One completed review → "1 Reviewed".
    const reviewed = await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.user.profileId },
      assignmentStatus: ProposalReviewAssignmentStatus.COMPLETED,
      proposalData: {
        title: REVIEWED_TITLE,
        collaborationDocId: 'test-proposal-listing-doc',
      },
    });

    // No assignments at all → "0 Reviewed" rather than nothing: the zero is the
    // signal the admin is tracking.
    const unreviewed = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: author.profileId,
      authUserId: author.authUserId,
      email: author.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: UNREVIEWED_TITLE,
        collaborationDocId: 'test-proposal-listing-doc-alt',
      },
    });

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    // The admin hero is shared with the two-tab variant; the list header below
    // is what distinguishes this surface.
    await expect(
      page.getByRole('heading', { name: 'Review Progress' }).first(),
    ).toBeVisible({ timeout: 36_000 });

    // "Proposals in review · {total}" replaces the plain proposal count, and
    // the reviewer tab pair is gone: an admin who is not a reviewer has no
    // queue to tab against. (The layout's own Overview/Current toggle is a tab
    // strip too, hence naming the two rather than counting every tab.)
    await expect(
      page
        .getByRole('heading', { name: 'Proposals in review · 2', level: 2 })
        .first(),
    ).toBeVisible({ timeout: 36_000 });
    await expect(
      page.getByRole('tab', { name: 'Proposals to review' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('tab', { name: 'Other proposals' }),
    ).toHaveCount(0);

    // The count is a link into the per-proposal Review Progress screen, for the
    // reviewed proposal and the untouched one alike.
    const reviewedCount = page
      .getByRole('link', { name: '1 Reviewed' })
      .first();
    await expect(reviewedCount).toBeVisible({ timeout: 36_000 });
    await expect(reviewedCount).toHaveAttribute(
      'href',
      new RegExp(
        `/decisions/${instance.slug}/proposal/${reviewed.proposal.profileId}/reviews$`,
      ),
    );

    const unreviewedCount = page
      .getByRole('link', { name: '0 Reviewed' })
      .first();
    await expect(unreviewedCount).toBeVisible();
    await expect(unreviewedCount).toHaveAttribute(
      'href',
      new RegExp(
        `/decisions/${instance.slug}/proposal/${unreviewed.profileId}/reviews$`,
      ),
    );

    // Both cards are on screen, so the two counts above are one per proposal —
    // the count is the whole decoration these cards carry.
    await expect(page.getByText(REVIEWED_TITLE).first()).toBeVisible();
    await expect(page.getByText(UNREVIEWED_TITLE).first()).toBeVisible();
  });
});
