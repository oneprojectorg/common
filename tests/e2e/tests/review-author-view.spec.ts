import type { DecisionSchemaDefinition } from '@op/common';
import { ProposalStatus, processInstances, proposals } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createOrganization,
  createProposal,
  createReviewAssignment,
  createRevisionRequest,
  getSeededTemplate,
  grantDecisionProfileAccess,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Schema with a review phase so the DecisionStateRouter renders the ReviewPage.
 */
const REVIEW_SCHEMA = {
  id: 'review-author-view',
  version: '1.0.0',
  name: 'Review Author View',
  description: 'Schema for non-reviewer review phase e2e tests.',
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

const MEMBER_PROPOSAL_TITLE = 'Community Solar Initiative';
const OTHER_PROPOSAL_TITLE = 'Urban Garden Expansion';

test.describe('Non-reviewer review-phase view', () => {
  test('member author sees Revise proposal + badge on own proposal and Like/Follow on others', async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    // -- Setup: decision in review phase owned by admin org ------------------

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

    // Create a member in a separate org — MEMBER role has submitProposals +
    // vote but NOT review, so this user is a non-reviewer.
    const memberOrg = await createOrganization({
      testId: `review-author-${Date.now()}`,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
    });
    const memberUser = memberOrg.adminUser;

    await grantDecisionProfileAccess({
      profileId: instance.profileId,
      authUserId: memberUser.authUserId,
      email: memberUser.email,
      isAdmin: false,
    });

    // Member-authored proposal with a pending revision request
    const memberProposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: memberUser.profileId,
      authUserId: memberUser.authUserId,
      email: memberUser.email,
      proposalData: {
        title: MEMBER_PROPOSAL_TITLE,
        collaborationDocId: 'test-proposal-view-doc',
      },
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.SUBMITTED })
      .where(eq(proposals.id, memberProposal.id));

    const memberAssignment = await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: memberProposal.id,
      reviewerProfileId: org.adminUser.profileId,
    });
    const revisionRequest = await createRevisionRequest({
      assignmentId: memberAssignment.id,
      requestComment: 'Please expand the budget section.',
    });

    // Admin-authored proposal the member does NOT own
    const otherProposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.adminUser.profileId,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: OTHER_PROPOSAL_TITLE,
        collaborationDocId: 'test-proposal-view-doc',
      },
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.SUBMITTED })
      .where(eq(proposals.id, otherProposal.id));

    // -- Act: log in as member and navigate --------------------------------

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await authenticateAsUser(memberPage, {
      email: memberUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await memberPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'domcontentloaded',
    });

    // -- Assert: non-reviewer lands on the proposals grid, not assignments --

    await expect(memberPage.getByText(MEMBER_PROPOSAL_TITLE)).toBeVisible({
      timeout: 36_000,
    });
    await expect(memberPage.getByText(OTHER_PROPOSAL_TITLE)).toBeVisible();
    await expect(memberPage.getByText('Proposals to review')).toHaveCount(0);

    // Member owns exactly one proposal in the list → one Revise button + one badge
    const reviseLink = memberPage.getByRole('link', { name: 'Revise proposal' });
    await expect(reviseLink).toHaveCount(1);
    await expect(reviseLink).toHaveAttribute(
      'href',
      new RegExp(`reviewRevision=${revisionRequest.id}`),
    );
    await expect(memberPage.getByText('Revision requested')).toHaveCount(1);

    // Non-owned proposal gets Like + Follow
    await expect(
      memberPage.getByRole('button', { name: 'Like' }),
    ).toHaveCount(1);
    await expect(
      memberPage.getByRole('button', { name: 'Follow' }),
    ).toHaveCount(1);

    await memberContext.close();
  });

  test('admin in review phase still sees reviewer assignments list', async ({
    authenticatedPage,
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

    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'domcontentloaded',
    });

    // Admin path renders ReviewAssignmentsList (not the non-reviewer grid)
    await expect(authenticatedPage.getByText('Proposals to review')).toBeVisible(
      { timeout: 36_000 },
    );
    await expect(
      authenticatedPage.getByRole('link', { name: 'Revise proposal' }),
    ).toHaveCount(0);
  });
});
