import { users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createOrganization,
  createSupabaseAdminClient,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Policy re-acceptance gate: a user who has not accepted the current Terms of
 * Use / Privacy Policy (null `tosAcceptedOn` / `privacyAcceptedOn`) must
 * re-accept in a non-dismissable modal before continuing. Accepting stamps both
 * dates, which closes the gate.
 *
 * `createOrganization` makes a network-member admin (so the walled-garden app
 * loads) whom the test helper marks as having accepted. We null those dates to
 * make them eligible; leaving them set is the not-eligible case.
 */
test.describe('Policy re-acceptance modal', () => {
  // Own the session: start clean and authenticate as the org we create, rather
  // than the shared worker user whose acceptance state we must not mutate.
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('user who has not accepted must re-accept, can read the docs, and accepting closes the gate', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `reaccept-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });

    // Clear acceptance so the user is eligible. onboardedAt stays set so they
    // reach the app rather than being redirected to onboarding.
    await db
      .update(users)
      .set({ tosAcceptedOn: null, privacyAcceptedOn: null })
      .where(eq(users.authUserId, org.adminUser.authUserId));

    await authenticateAsUser(page, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/', { waitUntil: 'domcontentloaded' });

    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: "We've updated our policies." }),
    ).toBeVisible({ timeout: 20000 });

    // Non-dismissable: Escape must not close it.
    await page.keyboard.press('Escape');
    await expect(
      dialog.getByRole('heading', { name: "We've updated our policies." }),
    ).toBeVisible();

    // The action is gated on the consent checkbox.
    const agree = dialog.getByRole('button', { name: 'Agree and continue' });
    await expect(agree).toBeDisabled();

    // A policy link opens that document in-modal with a working back button.
    await dialog.getByRole('button', { name: 'Terms of Use' }).click();
    await expect(
      dialog.getByRole('heading', {
        name: /TERMS OF SERVICE FOR COMMON PLATFORM/,
      }),
    ).toBeVisible({ timeout: 15000 });
    await dialog.getByRole('button', { name: 'Back' }).click();
    await expect(
      dialog.getByRole('heading', { name: "We've updated our policies." }),
    ).toBeVisible();

    // Accept and continue.
    await dialog.getByRole('checkbox').check();
    await expect(agree).toBeEnabled();
    await agree.click();

    // The gate closes once the account refetches with the dates stamped.
    await expect(
      page.getByRole('heading', { name: "We've updated our policies." }),
    ).toBeHidden({ timeout: 20000 });

    // And both acceptance dates are now recorded.
    const [record] = await db
      .select({
        tosAcceptedOn: users.tosAcceptedOn,
        privacyAcceptedOn: users.privacyAcceptedOn,
      })
      .from(users)
      .where(eq(users.authUserId, org.adminUser.authUserId));
    expect(record?.tosAcceptedOn).toBeTruthy();
    expect(record?.privacyAcceptedOn).toBeTruthy();
  });

  test('user who has already accepted never sees the gate', async ({
    page,
  }) => {
    // The test helper marks created users as having accepted the current
    // policies, so this admin is not eligible.
    const org = await createOrganization({
      testId: `reaccept-ok-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });

    await authenticateAsUser(page, {
      email: org.adminUser.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/', { waitUntil: 'domcontentloaded' });

    // The home lands (not the gate).
    await expect(
      page.getByRole('heading', { level: 1, name: /Welcome back/ }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByRole('heading', { name: "We've updated our policies." }),
    ).toBeHidden();
  });
});
