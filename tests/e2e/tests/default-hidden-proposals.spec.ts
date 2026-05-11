import {
  EntityType,
  ProcessStatus,
  ProposalStatus,
  Visibility,
  decisionProcesses,
  processInstances,
  profiles,
  profileUserToAccessRoles,
  profileUsers,
  proposals,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import {
  createOrganization,
  createProposal,
  grantDecisionProfileAccess,
} from '@op/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

function isoDateOffset(daysFromNow: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function createProcessWithDefaultHidden({
  org,
}: {
  org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  };
}) {
  // Rolling dates so the submission phase is always "current" relative to test run.
  const submissionStart = isoDateOffset(-1);
  const submissionEnd = isoDateOffset(30);
  const reviewStart = isoDateOffset(31);
  const reviewEnd = isoDateOffset(60);

  const processSchema = {
    id: 'default-hidden-test',
    version: '1.0.0',
    name: 'Default Hidden Test',
    description: 'Process for testing default hidden proposals',
    phases: [
      {
        id: 'submission',
        name: 'Proposal Submission',
        description: 'Submit proposals',
        rules: {
          proposals: { submit: true, defaults: { hidden: true } },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'review',
        name: 'Review',
        description: 'Review proposals',
        rules: {
          proposals: { submit: false },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
    ],
  };

  const instanceData = {
    budget: 50000,
    hideBudget: false,
    phases: [
      {
        phaseId: 'submission',
        name: 'Proposal Submission',
        rules: {
          proposals: { submit: true, defaults: { hidden: true } },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
        startDate: submissionStart,
        endDate: submissionEnd,
      },
      {
        phaseId: 'review',
        name: 'Review',
        rules: {
          proposals: { submit: false },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
        startDate: reviewStart,
        endDate: reviewEnd,
      },
    ],
  };

  const processName = `Default Hidden ${randomUUID().slice(0, 8)}`;

  const [process] = await db
    .insert(decisionProcesses)
    .values({
      name: processName,
      description: 'Default hidden proposals e2e test',
      processSchema,
      createdByProfileId: org.organizationProfile.id,
    })
    .returning();

  if (!process) {
    throw new Error('Failed to create process');
  }

  const slug = `test-default-hidden-${randomUUID()}`;
  const name = `${processName} Instance`;

  const [profile] = await db
    .insert(profiles)
    .values({ name, slug, type: EntityType.DECISION })
    .returning();

  if (!profile) {
    throw new Error('Failed to create instance profile');
  }

  const [instance] = await db
    .insert(processInstances)
    .values({
      name,
      processId: process.id,
      profileId: profile.id,
      instanceData,
      currentStateId: 'submission',
      status: ProcessStatus.PUBLISHED,
      ownerProfileId: org.organizationProfile.id,
    })
    .returning();

  if (!instance) {
    throw new Error('Failed to create process instance');
  }

  const [profileUser] = await db
    .insert(profileUsers)
    .values({
      profileId: profile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    })
    .returning();

  if (profileUser) {
    await db.insert(profileUserToAccessRoles).values({
      profileUserId: profileUser.id,
      accessRoleId: ROLES.ADMIN.id,
    });
  }

  return { process, instance, profile, slug, name };
}

test.describe('Default Hidden Proposals', () => {
  test('admin sees hidden proposal, non-admin member does not', async ({
    browser,
    authenticatedPage,
    org,
    supabaseAdmin,
  }) => {
    const { instance, slug, name, profile } =
      await createProcessWithDefaultHidden({ org });

    // Create a member user in a separate org
    const memberOrg = await createOrganization({
      testId: `dhp-member-${Date.now()}`,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
    });
    const memberUser = memberOrg.adminUser;

    await grantDecisionProfileAccess({
      profileId: profile.id,
      authUserId: memberUser.authUserId,
      email: memberUser.email,
      isAdmin: false,
    });

    // Create a proposal submitted by the member, then set HIDDEN visibility
    // (simulating what createProposal does when defaults.hidden is true)
    const hiddenProposal = await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: memberUser.profileId,
      authUserId: memberUser.authUserId,
      email: memberUser.email,
      proposalData: {
        title: 'Hidden By Default Proposal',
        description:
          '<p>This proposal should be hidden from other members.</p>',
      },
      status: ProposalStatus.SUBMITTED,
    });

    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, hiddenProposal.id));

    // Admin navigates — should see the proposal, banner, and filters.
    await authenticatedPage.goto(`/en/decisions/${slug}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(authenticatedPage.getByRole('heading', { name })).toBeVisible({
      timeout: 30_000,
    });

    // Banner is rendered as role="status" with the privacy copy.
    await expect(
      authenticatedPage.getByRole('status').filter({
        hasText: 'Proposals are private during this phase',
      }),
    ).toBeVisible({ timeout: 15_000 });

    const adminProposalLink = authenticatedPage.getByRole('link', {
      name: 'Hidden By Default Proposal',
    });
    await expect(adminProposalLink).toBeVisible({ timeout: 15_000 });

    // Admins keep the filter dropdowns visible. The Select renders a button
    // whose accessible name is `<selected value> Filter proposals`, so anchor
    // the regex at the end to avoid also matching "Filter proposals by category".
    await expect(
      authenticatedPage.getByRole('button', { name: /Filter proposals$/ }),
    ).toBeVisible();

    // The "Hidden" badge is scoped to the proposal card containing the link.
    const adminProposalCard = authenticatedPage
      .locator('div')
      .filter({ has: adminProposalLink })
      .first();
    await expect(
      adminProposalCard.getByText('Hidden', { exact: true }),
    ).toBeVisible();

    // Member who did NOT submit the proposal navigates — should NOT see it.
    const otherMemberOrg = await createOrganization({
      testId: `dhp-other-${Date.now()}`,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
    });
    const otherMember = otherMemberOrg.adminUser;

    await grantDecisionProfileAccess({
      profileId: profile.id,
      authUserId: otherMember.authUserId,
      email: otherMember.email,
      isAdmin: false,
    });

    const otherMemberCtx = await browser.newContext();
    const otherMemberPage = await otherMemberCtx.newPage();
    await authenticateAsUser(otherMemberPage, {
      email: otherMember.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await otherMemberPage.goto(`/en/decisions/${slug}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(otherMemberPage.getByRole('heading', { name })).toBeVisible({
      timeout: 30_000,
    });

    // Banner is shown to non-admins too.
    await expect(
      otherMemberPage.getByRole('status').filter({
        hasText: 'Proposals are private during this phase',
      }),
    ).toBeVisible({ timeout: 15_000 });

    // Filters are hidden for non-admins when proposals are default-hidden.
    await expect(
      otherMemberPage.getByRole('button', { name: /Filter proposals$/ }),
    ).toBeHidden();

    // Wait for the empty-state copy (positive readiness signal) so we're not
    // racing the lazy load before asserting the proposal link is absent.
    await expect(
      otherMemberPage.getByText(
        "You'll see your proposal here once you submit.",
      ),
    ).toBeVisible({ timeout: 15_000 });

    // Other member should NOT see the hidden proposal.
    await expect(
      otherMemberPage.getByRole('link', {
        name: 'Hidden By Default Proposal',
      }),
    ).toBeHidden();

    await otherMemberCtx.close();
  });

  test('proposal owner can see their own hidden proposal', async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    const { instance, slug, name, profile } =
      await createProcessWithDefaultHidden({ org });

    // Create a member who submits a hidden proposal
    const submitterOrg = await createOrganization({
      testId: `dhp-submitter-${Date.now()}`,
      supabaseAdmin,
      users: { admin: 1, member: 0 },
    });
    const submitter = submitterOrg.adminUser;

    await grantDecisionProfileAccess({
      profileId: profile.id,
      authUserId: submitter.authUserId,
      email: submitter.email,
      isAdmin: false,
    });

    const ownerProposal = await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: submitter.profileId,
      authUserId: submitter.authUserId,
      email: submitter.email,
      proposalData: {
        title: 'My Hidden Proposal',
        description: '<p>Submitter should see their own proposal.</p>',
      },
      status: ProposalStatus.SUBMITTED,
    });

    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, ownerProposal.id));

    // Submitter navigates — should see their own hidden proposal
    const submitterCtx = await browser.newContext();
    const submitterPage = await submitterCtx.newPage();
    await authenticateAsUser(submitterPage, {
      email: submitter.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await submitterPage.goto(`/en/decisions/${slug}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(submitterPage.getByRole('heading', { name })).toBeVisible({
      timeout: 30_000,
    });

    // Submitter sees the privacy banner just like everyone else.
    await expect(
      submitterPage.getByRole('status').filter({
        hasText: 'Proposals are private during this phase',
      }),
    ).toBeVisible({ timeout: 15_000 });

    // Filters remain hidden for non-admin submitters even though they see
    // their own proposal — the filter UI is admin-only in this phase.
    await expect(
      submitterPage.getByRole('button', { name: /Filter proposals$/ }),
    ).toBeHidden();

    const submitterProposalLink = submitterPage.getByRole('link', {
      name: 'My Hidden Proposal',
    });
    await expect(submitterProposalLink).toBeVisible({ timeout: 15_000 });

    // The "Hidden" badge shows on the owner's view of their own card.
    const submitterProposalCard = submitterPage
      .locator('div')
      .filter({ has: submitterProposalLink })
      .first();
    await expect(
      submitterProposalCard.getByText('Hidden', { exact: true }),
    ).toBeVisible();

    await submitterCtx.close();
  });
});
