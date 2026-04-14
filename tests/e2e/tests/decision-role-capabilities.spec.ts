import {
  type DecisionSchemaDefinition,
  createDecisionInstance,
  createOrganization,
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
 * Schema that starts in the submission phase (proposals allowed).
 * currentStateId will be 'submission', routing to StandardDecisionPage.
 */
const submissionPhaseSchema: DecisionSchemaDefinition = {
  id: 'test-submission',
  version: '1.0.0',
  name: 'Test Submission Schema',
  description: 'Schema for testing submission phase',
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
  ],
};

/**
 * Schema that starts in the review phase (proposals NOT allowed).
 * currentStateId will be 'review', routing to ReviewPage.
 */
const reviewPhaseSchema: DecisionSchemaDefinition = {
  id: 'test-review',
  version: '1.0.0',
  name: 'Test Review Schema',
  description: 'Schema for testing review phase',
  phases: [
    {
      id: 'review',
      name: 'Review',
      description: 'Reviewing proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
};

/**
 * Schema that starts in the voting phase.
 * currentStateId will be 'voting', routing to VotingPage which shows MyBallot.
 */
const votingPhaseSchema: DecisionSchemaDefinition = {
  id: 'test-voting',
  version: '1.0.0',
  name: 'Test Voting Schema',
  description: 'Schema for testing voting phase',
  phases: [
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote.',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'manual' as const },
      },
    },
  ],
};

test.describe('Decision Role Capabilities', () => {
  test('submit proposal button is visible to a member with submitProposals permission in submission phase', async ({
    browser,
    org,
    supabaseAdmin,
  }) => {
    const template = await getSeededTemplate();

    // Create instance in submission phase, no admin access granted to creator
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: submissionPhaseSchema,
      grantAdminAccess: false,
    });

    // Create a member user in a separate org and grant them member-level
    // decision access (MEMBER role includes submitProposals = true)
    const memberOrg = await createOrganization({
      testId: `role-caps-member-${Date.now()}`,
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

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await authenticateAsUser(memberPage, {
      email: memberUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await memberPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    await expect(
      memberPage.getByRole('heading', { name: instance.name }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      memberPage.getByRole('button', { name: 'Start a proposal' }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('submit proposal button is hidden when phase does not allow proposals', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    // Admin user, but phase rules disallow proposal submission
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: reviewPhaseSchema,
    });

    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    // Even though admin has submitProposals permission, phase rules block the button
    await expect(
      authenticatedPage.getByRole('button', { name: 'Start a proposal' }),
    ).not.toBeVisible();
  });

  test('ballot section is shown for a user with vote permission in voting phase', async ({
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
      schema: votingPhaseSchema,
      grantAdminAccess: false,
    });

    // Grant member access — MEMBER role includes vote = true
    const memberOrg = await createOrganization({
      testId: `role-caps-voter-${Date.now()}`,
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

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await authenticateAsUser(memberPage, {
      email: memberUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await memberPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    await expect(
      memberPage.getByRole('heading', { name: instance.name }),
    ).toBeVisible({ timeout: 15000 });

    // The ballot section is rendered only when instance.access.vote === true.
    // "You did not vote in this process." confirms MyBallot fully loaded (no votes cast yet).
    await expect(
      memberPage.getByText('You did not vote in this process.'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('ballot section is not shown outside the voting phase', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: submissionPhaseSchema,
    });

    await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'networkidle',
    });

    await expect(
      authenticatedPage.getByRole('heading', { name: instance.name }),
    ).toBeVisible({ timeout: 15000 });

    // MyBallot is only rendered on VotingPage (currentStateId === 'voting')
    await expect(authenticatedPage.getByTestId('my-ballot')).not.toBeVisible();
  });
});
