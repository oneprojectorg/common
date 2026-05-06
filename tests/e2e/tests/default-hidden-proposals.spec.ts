import {
  EntityType,
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

async function createProcessWithDefaultHidden({
  org,
}: {
  org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  };
}) {
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
          proposals: { submit: true, defaultHidden: true },
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
          proposals: { submit: true, defaultHidden: true },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      },
      {
        phaseId: 'review',
        name: 'Review',
        rules: {
          proposals: { submit: false },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
        startDate: '2026-01-01',
        endDate: '2026-12-31',
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
      status: 'PUBLISHED',
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
    // (simulating what submitProposal does when defaultHidden is true)
    const hiddenProposal = await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: memberOrg.organizationProfile.id,
      authUserId: memberUser.authUserId,
      email: memberUser.email,
      proposalData: {
        title: 'Hidden By Default Proposal',
        description: '<p>This proposal should be hidden from other members.</p>',
      },
      status: ProposalStatus.SUBMITTED,
    });

    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, hiddenProposal.id));

    // Admin navigates — should see the proposal
    await authenticatedPage.goto(`/en/decisions/${slug}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      authenticatedPage.getByRole('heading', { name }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      authenticatedPage.getByRole('link', {
        name: 'Hidden By Default Proposal',
      }),
    ).toBeVisible({ timeout: 15_000 });

    // Admin should see the "Hidden" label
    await expect(authenticatedPage.getByText('Hidden')).toBeVisible();

    // Member who did NOT submit the proposal navigates — should NOT see it
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

    await expect(
      otherMemberPage.getByRole('heading', { name }),
    ).toBeVisible({ timeout: 30_000 });

    // Other member should NOT see the hidden proposal
    await expect(
      otherMemberPage.getByRole('link', {
        name: 'Hidden By Default Proposal',
      }),
    ).not.toBeVisible({ timeout: 5_000 });

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
      submittedByProfileId: submitterOrg.organizationProfile.id,
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

    await expect(
      submitterPage.getByRole('heading', { name }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      submitterPage.getByRole('link', {
        name: 'My Hidden Proposal',
      }),
    ).toBeVisible({ timeout: 15_000 });

    await submitterCtx.close();
  });
});
