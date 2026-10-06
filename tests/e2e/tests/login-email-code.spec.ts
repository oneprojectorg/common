import { randomUUID } from 'node:crypto';

import {
  createOrganization,
  createSupabaseAdminClient,
  expect,
  readLoginCode,
  test,
} from '../fixtures/index.js';

/**
 * Email sign-in by code: GoTrue issues the code at the length the Supabase
 * project configures, and the app sizes its field from
 * `NEXT_PUBLIC_AUTH_EMAIL_OTP_LENGTH`. The two are set in different places,
 * so this runs the whole exchange: request the code, read the email Mailpit
 * caught, type it into the field the app rendered, and land signed in.
 *
 * A field shorter than the code truncates it, GoTrue rejects the remainder,
 * and the person sees "Token has expired or is invalid". That is the failure
 * this spec exists to catch.
 */
test.describe('Login by email code', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const admin = createSupabaseAdminClient();

  test('the emailed code fits the field and signs the person in', async ({
    page,
  }) => {
    const org = await createOrganization({
      testId: `email-code-${randomUUID().slice(0, 6)}`,
      supabaseAdmin: admin,
      users: { admin: 1, member: 0 },
    });
    const { email } = org.adminUser;

    await page.goto('/login', { waitUntil: 'networkidle' });

    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();

    await expect(
      page.getByRole('heading', { name: 'Check your email' }),
    ).toBeVisible({ timeout: 20_000 });

    const code = await readLoginCode(email);

    await expect(page.locator('[data-slot="input-otp-slot"]')).toHaveCount(
      code.length,
    );

    await page.getByRole('textbox', { name: 'Code' }).fill(code);

    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(
      page.getByRole('heading', { level: 1, name: /Welcome back/ }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
