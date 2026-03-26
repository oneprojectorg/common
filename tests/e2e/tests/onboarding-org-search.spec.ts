import { joinProfileRequests, users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createSupabaseAdminClient,
  createUser,
  expect,
  test,
} from '../fixtures/index.js';

test.describe('Onboarding - Organization Search (no domain match)', () => {
  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

  test.beforeAll(() => {
    supabaseAdmin = createSupabaseAdminClient();
  });

  test('user without domain-matched org sees search screen and can skip to app', async ({
    page,
  }) => {
    // Use a domain that won't match any existing org
    const email = `e2e-org-search-skip-${randomUUID().slice(0, 6)}@no-match-domain-test.example.com`;
    const authUser = await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    // Step 1: Should see the personal details form first
    await expect(
      page.getByRole('heading', { name: 'Set up your individual profile.' }),
    ).toBeVisible({ timeout: 15000 });

    // Fill in required fields
    await page.getByLabel('Full Name').fill('Test User Skip');
    await page.getByLabel('Headline').fill('Test Engineer');

    // Email field is pre-populated with the auth email; fill it in case it's empty
    const emailField = page.getByLabel('Email');
    await emailField.clear();
    await emailField.fill(email);

    // Submit personal details
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Should see the organization search screen (not org creation)
    await expect(
      page.getByRole('heading', {
        name: 'Find organizations you belong to',
      }),
    ).toBeVisible({ timeout: 15000 });

    // Step 3: Click "Skip for now"
    await page.getByRole('button', { name: 'Skip for now' }).click();

    // Step 4: Should see the ToS acceptance screen
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });

    // Step 5: Accept ToS and Privacy Policy checkboxes
    // Each checkbox label is "I accept the" with the link text in a sibling element
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.nth(0).click(); // Terms of Service
    await checkboxes.nth(1).click(); // Privacy Policy

    // Step 6: Click "Join Common"
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Step 7: Should redirect to /?new=1
    await page.waitForURL(/new=1/, { timeout: 30000 });
    expect(page.url()).toContain('new=1');

    // Step 8: Verify no join requests were created for this user
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (userRecord?.profileId) {
      const joinRequests = await db
        .select()
        .from(joinProfileRequests)
        .where(
          eq(joinProfileRequests.requestProfileId, userRecord.profileId),
        );

      expect(joinRequests).toHaveLength(0);
    }
  });
});
