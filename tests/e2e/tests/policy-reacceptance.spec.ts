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
 * Policy re-acceptance gate: an already-onboarded user whose `onboardedAt`
 * predates the updated Terms of Use / Privacy Policy / Code of Conduct must
 * re-accept in a non-dismissable modal before continuing. Accepting stamps a
 * fresh `onboardedAt`, which closes the gate.
 *
 * `createOrganization` makes a network-member admin (so the walled-garden app
 * loads) who is onboarded at "now". We rewind that `onboardedAt` to make them
 * eligible; leaving it at "now" (after the cutoff) is the not-eligible case.
 */
test.describe('Policy re-acceptance modal', () => {
  // Own the session: start clean and authenticate as the org we create, rather
  // than the shared worker user (whose onboardedAt we must not mutate).
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();
  // Before the 2026-07-13 UTC cutoff baked into the eligibility helper.
  const BEFORE_CUTOFF = '2026-01-01T00:00:00.000Z';

  test('eligible user must re-accept, can read the docs, and accepting closes the gate', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `reaccept-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });

    // Rewind onboarding to before the policy update so the user is eligible.
    await db
      .update(users)
      .set({ onboardedAt: BEFORE_CUTOFF })
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

    // The gate closes once the account refetches past the cutoff.
    await expect(
      page.getByRole('heading', { name: "We've updated our policies." }),
    ).toBeHidden({ timeout: 20000 });

    // And onboardedAt has been stamped forward past the cutoff.
    const [record] = await db
      .select({ onboardedAt: users.onboardedAt })
      .from(users)
      .where(eq(users.authUserId, org.adminUser.authUserId));
    const onboardedAt = record?.onboardedAt;
    expect(onboardedAt).toBeTruthy();
    if (onboardedAt) {
      expect(new Date(onboardedAt).getTime()).toBeGreaterThan(
        new Date(BEFORE_CUTOFF).getTime(),
      );
    }
  });

  test('user onboarded after the cutoff never sees the gate', async ({
    page,
  }) => {
    // createOrganization onboards the admin at "now", which is after the cutoff.
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
