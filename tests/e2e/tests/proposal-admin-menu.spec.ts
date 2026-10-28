import {
  createDecisionInstance,
  createInstanceMember,
  createProposal,
  createReviewAssignment,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceProfileAdminRole,
  grantInstanceReviewerRole,
  testMinimalSchema,
  testReviewPhaseSchema,
  testRubricTemplate,
} from '@op/common/testing/data';
import { ProposalStatus } from '@op/db/schema';
import type { Browser } from '@playwright/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

const PROPOSAL_TITLE = 'Participant Proposal';
// The review screen reads the proposal body from the collab document, so it
// needs one the e2e mock pre-seeds; the title comes from that fragment.
const REVIEW_SCREEN_DOC_ID = 'test-proposal-listing-doc';
const REVIEW_SCREEN_TITLE = 'Community Garden Project';

const PHASES = [
  { phase: 'submission', schema: testMinimalSchema, currentStateId: undefined },
  { phase: 'review', schema: testReviewPhaseSchema, currentStateId: 'review' },
] as const;

/** Signs the viewer in, opens the page and reports whether the `…` menu is offered. */
async function expectMenuFor({
  browser,
  viewer,
  url,
  title,
  offered,
}: {
  browser: Browser;
  viewer: { email: string };
  url: string;
  title: string;
  offered: boolean;
}) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await authenticateAsUser(page, {
      email: viewer.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    await page.goto(url, { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: title })).toBeVisible({
      timeout: 30_000,
    });

    const menuTrigger = page.getByRole('button', { name: 'Proposal options' });
    if (!offered) {
      await expect(menuTrigger).toHaveCount(0);
      return;
    }
    await menuTrigger.click({ timeout: 30_000 });
    await expect(
      page.getByRole('menuitem', { name: 'Merge with another proposal' }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Hide proposal' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
}

test.describe('Proposal page admin menu', () => {
  for (const { phase, schema, currentStateId } of PHASES) {
    test(`in a ${phase} phase, is offered to decision admins but not to a participant viewing their own proposal`, async ({
      browser,
      org,
      supabaseAdmin,
    }) => {
      const template = await getSeededTemplate();
      const instance = await createDecisionInstance({
        processId: template.id,
        ownerProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        schema,
        currentStateId,
      });

      const testId = `proposal-admin-menu-${phase}-${Date.now()}`;
      const [{ user: participant }, { user: profileAdmin }] = await Promise.all(
        [
          createInstanceMember({
            supabaseAdmin,
            testId: `${testId}-participant`,
            instanceProfileId: instance.profileId,
          }),
          createInstanceMember({
            supabaseAdmin,
            testId: `${testId}-profile-admin`,
            instanceProfileId: instance.profileId,
          }),
        ],
      );
      const [proposal] = await Promise.all([
        createProposal({
          processInstanceId: instance.instance.id,
          submittedByProfileId: participant.profileId,
          authUserId: participant.authUserId,
          email: participant.email,
          proposalData: { title: PROPOSAL_TITLE },
          status: ProposalStatus.SUBMITTED,
        }),
        // Profile ADMIN without the decisions ADMIN bit: the review screen
        // already treats this user as an admin, so the proposal page must too.
        grantInstanceProfileAdminRole({
          instanceProfileId: instance.profileId,
          authUserId: profileAdmin.authUserId,
          email: profileAdmin.email,
        }),
      ]);
      const proposalUrl = `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`;

      await Promise.all([
        expectMenuFor({
          browser,
          viewer: participant,
          url: proposalUrl,
          title: PROPOSAL_TITLE,
          offered: false,
        }),
        expectMenuFor({
          browser,
          viewer: profileAdmin,
          url: proposalUrl,
          title: PROPOSAL_TITLE,
          offered: true,
        }),
        expectMenuFor({
          browser,
          viewer: org.adminUser,
          url: proposalUrl,
          title: PROPOSAL_TITLE,
          offered: true,
        }),
      ]);
    });
  }

  test('on the review screen, is offered to a reviewer who is a decision admin but not to a plain reviewer', async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: testReviewPhaseSchema,
      currentStateId: 'review',
      rubricTemplate: testRubricTemplate,
    });

    const testId = `proposal-admin-menu-review-screen-${Date.now()}`;
    const [{ user: author }, { user: reviewer }] = await Promise.all([
      createInstanceMember({
        supabaseAdmin,
        testId: `${testId}-author`,
        instanceProfileId: instance.profileId,
      }),
      createInstanceMember({
        supabaseAdmin,
        testId: `${testId}-reviewer`,
        instanceProfileId: instance.profileId,
      }),
    ]);
    // Only the assigned reviewer can open an assignment, so both viewers get
    // one: the plain reviewer through the Reviewer role, the admin through
    // the Admin role the instance factory granted.
    const [{ proposal, assignedProposalHistoryId, assignment }] =
      await Promise.all([
        createReviewScenario({
          instance: { id: instance.instance.id },
          author,
          reviewer: { profileId: reviewer.profileId },
          proposalData: {
            title: REVIEW_SCREEN_TITLE,
            collaborationDocId: REVIEW_SCREEN_DOC_ID,
          },
        }),
        grantInstanceReviewerRole({
          instanceProfileId: instance.profileId,
          authUserId: reviewer.authUserId,
          email: reviewer.email,
        }),
      ]);
    const adminAssignment = await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: proposal.id,
      reviewerProfileId: org.adminUser.profileId,
      assignedProposalHistoryId,
    });
    const reviewRoot = `/en/decisions/${instance.slug}/reviews`;

    await Promise.all([
      expectMenuFor({
        browser,
        viewer: reviewer,
        url: `${reviewRoot}/${assignment.id}`,
        title: REVIEW_SCREEN_TITLE,
        offered: false,
      }),
      expectMenuFor({
        browser,
        viewer: org.adminUser,
        url: `${reviewRoot}/${adminAssignment.id}`,
        title: REVIEW_SCREEN_TITLE,
        offered: true,
      }),
    ]);
  });

  test("on a proposal's review progress screen, is offered to a decision admin who is not a reviewer", async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: testReviewPhaseSchema,
      currentStateId: 'review',
      rubricTemplate: testRubricTemplate,
    });

    const testId = `proposal-admin-menu-review-progress-${Date.now()}`;
    const [{ user: author }, { user: reviewer }] = await Promise.all([
      createInstanceMember({
        supabaseAdmin,
        testId: `${testId}-author`,
        instanceProfileId: instance.profileId,
      }),
      createInstanceMember({
        supabaseAdmin,
        testId: `${testId}-reviewer`,
        instanceProfileId: instance.profileId,
      }),
    ]);
    const [{ proposal }] = await Promise.all([
      createReviewScenario({
        instance: { id: instance.instance.id },
        author,
        reviewer: { profileId: reviewer.profileId },
        proposalData: {
          title: REVIEW_SCREEN_TITLE,
          collaborationDocId: REVIEW_SCREEN_DOC_ID,
        },
      }),
      grantInstanceReviewerRole({
        instanceProfileId: instance.profileId,
        authUserId: reviewer.authUserId,
        email: reviewer.email,
      }),
    ]);
    // The proposal-keyed reviews URL resolves per viewer: the admin lands on
    // the review progress summary, the assigned reviewer on their own review.
    const url = `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/reviews`;

    await Promise.all([
      expectMenuFor({
        browser,
        viewer: reviewer,
        url,
        title: REVIEW_SCREEN_TITLE,
        offered: false,
      }),
      expectMenuFor({
        browser,
        viewer: org.adminUser,
        url,
        title: REVIEW_SCREEN_TITLE,
        offered: true,
      }),
    ]);
  });
});
