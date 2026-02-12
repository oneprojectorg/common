import { EntityType, profileInvites } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db } from '@op/db/test';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createSupabaseAdminClient,
  createUser,
  expect,
  test,
} from '../fixtures/index.js';

test.describe('Proposal Invite', () => {
  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  test.beforeAll(() => {
    supabaseAdmin = createSupabaseAdminClient();
  });

  test('valid invite redirects to proposal page', async ({ page, org }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Invite Test Proposal',
      },
    });

    // Create a new user to receive the invite
    const inviteeEmail = `e2e-invite-${randomUUID().slice(0, 6)}@oneproject.org`;
    await createUser({ supabaseAdmin, email: inviteeEmail });

    // Insert a pending proposal invite for the new user
    await db.insert(profileInvites).values({
      email: inviteeEmail,
      profileId: proposal.profileId,
      profileEntityType: EntityType.PROPOSAL,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: instance.profileId,
    });

    // Authenticate as the invitee
    await authenticateAsUser(page, {
      email: inviteeEmail,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    // Navigate to the invite accept page (no inviteId needed — looks up by email)
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/invite`,
    );

    // Should redirect to the proposal page (no /invite in URL)
    await expect(page).toHaveURL(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      { timeout: 15000 },
    );
  });

  test('invalid invite shows error state', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(
      `/en/decisions/fake-slug/proposal/fake-profile/invite`,
    );

    await expect(
      authenticatedPage.getByText('This invite is no longer valid'),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      authenticatedPage.getByRole('link', { name: 'Go back' }),
    ).toBeVisible();
  });
});
