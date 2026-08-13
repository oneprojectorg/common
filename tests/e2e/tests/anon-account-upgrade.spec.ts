import {
  createDecisionInstance,
  getSeededTemplate,
  makeDecisionPublic,
} from '@op/test';
import { randomUUID } from 'node:crypto';

import {
  authenticateAnonymously,
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Anonymous-account upgrade ("promote") flow: an anon visitor on a public
 * decision upgrades via PromoteAccountModal → /login?link=1 (email link) →
 * slimmed onboarding (/start?promote=1) → back to the decision.
 *
 * Regression guarded: the upgraded visitor is intentionally NOT a network
 * member, so /start's walled-garden gate used to 403 right after the email step;
 * the gate now admits the promote flow.
 *
 * Note: e2e Supabase has email confirmations off, so the OTP screen is skipped
 * and entering the email advances straight to /start — where the 403 occurred.
 */
test.describe('Anonymous account upgrade (promote flow)', () => {
  // Start with no session; the test establishes an anonymous one itself.
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('upgrades an anonymous visitor via email and completes onboarding', async ({
    page,
  }) => {
    // A published, public decision the anonymous visitor can view (so the
    // decision page — and the promote modal mounted on it — renders).
    const org = await createOrganization({
      testId: `promote-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });
    // Open the decision to the public so the anonymous visitor can view it (and
    // the promote modal mounted on it renders).
    await makeDecisionPublic({ profileId: instance.profileId });

    // Anonymous Supabase session — the state the promote flow upgrades from.
    await authenticateAnonymously(page);

    // Land on the promote modal (we skip actually submitting a proposal and
    // just open the decision with the flag the editor would have set).
    await page.goto(`/en/decisions/${instance.slug}?promote=1`, {
      waitUntil: 'networkidle',
    });

    await expect(
      page.getByRole('heading', { name: 'Your idea was submitted.' }),
    ).toBeVisible({ timeout: 15000 });

    // Choose "Create account" → link mode on the login page.
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/login\?link=1/, { timeout: 15000 });

    // LinkAccountPanel: enter an email and continue.
    const email = `promote-${randomUUID().slice(0, 8)}@example.com`;
    await page.getByLabel('Email').fill(email);

    // Confirmations are off in e2e, so entering the email applies it
    // immediately and navigates to onboarding. Reaching /start — instead of the
    // walled-garden forbidden (403) screen — IS the regression check.
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/start\?.*promote=1/, { timeout: 20000 });
    await expect(
      page.getByText('You do not have permission to view this page'),
    ).not.toBeVisible();

    // PromoteOnboardingFlow — step 1: personal details.
    await expect(
      page.getByRole('heading', { name: 'Add your personal details' }),
    ).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Full Name').fill('Promo Tester');
    await page.getByLabel('Headline').fill('Community member');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: accept Terms of Service + Privacy Policy.
    await expect(
      page.getByRole('heading', { name: 'One last step' }),
    ).toBeVisible({ timeout: 15000 });
    // React Aria renders a decorative box over the input, so force the click
    // past it rather than targeting the visually-hidden checkbox center.
    const accept = page.getByRole('checkbox', { name: 'I accept the' });
    await accept.nth(0).check({ force: true });
    await accept.nth(1).check({ force: true });
    await page.getByRole('button', { name: 'Join Common' }).click();

    // Onboarding complete → returned to the decision they came from.
    await expect(page).toHaveURL(new RegExp(`/decisions/${instance.slug}`), {
      timeout: 20000,
    });
    await expect(page).not.toHaveURL(/\/start/);
  });
});
