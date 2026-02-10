import { EntityType, profileInvites, users } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import { createDecisionInstance, getSeededTemplate } from '@op/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createSupabaseAdminClient,
  createUser,
  expect,
  test,
} from '../fixtures/index.js';

test.describe('Onboarding', () => {
  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  test.beforeAll(() => {
    supabaseAdmin = createSupabaseAdminClient();
  });

  test('skips invites when none pending', async ({ page }) => {
    const email = `e2e-onboard-noinvite-${randomUUID().slice(0, 6)}@oneproject.org`;
    await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'networkidle' });

    // Should skip directly to personal details form
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });

    // Should NOT show decision invites heading
    await expect(
      page.getByRole('heading', {
        name: 'Join decision-making processes',
      }),
    ).not.toBeVisible();
  });

  test('shows invites when pending, accepts and proceeds', async ({ page }) => {
    const email = `e2e-onboard-invite-${randomUUID().slice(0, 6)}@oneproject.org`;
    const authUser = await createUser({ supabaseAdmin, email });

    // Look up the profile created by the DB trigger
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!userRecord?.profileId) {
      throw new Error(`No profile found for user ${email}`);
    }

    // Create a decision instance to invite the user to
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: userRecord.profileId,
      authUserId: authUser.id,
      email,
      schema: template.processSchema,
      grantAdminAccess: false,
    });

    // Insert a pending invite for the user
    await db.insert(profileInvites).values({
      email,
      profileId: instance.profileId,
      profileEntityType: EntityType.DECISION,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: instance.profileId,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'networkidle' });

    // Should show the decision invites screen
    await expect(
      page.getByRole('heading', {
        name: 'Join decision-making processes',
      }),
    ).toBeVisible({ timeout: 15000 });

    // Click Continue to accept the invite(s)
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should proceed to personal details form
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });
  });
});
