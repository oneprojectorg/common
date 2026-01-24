import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { type E2ETestDataManager, test as testDataTest } from './test-data';

interface AuthenticatedUser {
  email: string;
  password: string;
  authUserId: string;
}

/**
 * Creates a Supabase admin client for auth operations.
 */
function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables for auth operations',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Generates an OTP for a user using Supabase Admin API.
 * Returns the raw OTP token that can be used to verify.
 */
async function generateOtpForUser(email: string): Promise<string> {
  const supabaseAdmin = createSupabaseAdmin();

  // Generate a magic link which contains the OTP
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error || !data.properties?.email_otp) {
    throw new Error(`Failed to generate OTP: ${error?.message}`);
  }

  return data.properties.email_otp;
}

/**
 * Authenticates by performing a real login through the UI with OTP.
 *
 * Flow:
 * 1. Go to login page and enter email
 * 2. Click sign in (this triggers account.login which sends an OTP via signInWithOtp)
 * 3. Wait for OTP input to appear
 * 4. Generate a NEW OTP using admin API (this replaces the one sent by email)
 * 5. Enter the OTP and submit
 */
async function loginViaUI(page: Page, user: { email: string }): Promise<void> {
  await page.goto('/login');

  // Fill in the email
  await page.getByRole('textbox', { name: /email/i }).fill(user.email);

  // Click sign in to request OTP (this triggers account.login which calls signInWithOtp)
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for the OTP input to appear (indicated by "Email sent!" text)
  await page.waitForSelector('input[aria-label="Code"]', { timeout: 15000 });

  // NOW generate a fresh OTP - this will be valid because it's created after
  // the login request. The admin generateLink creates a new valid token.
  const otp = await generateOtpForUser(user.email);

  // Fill in the OTP
  await page.getByRole('textbox', { name: /code/i }).fill(otp);

  // Click login button to verify OTP
  await page.getByRole('button', { name: /login/i }).click();

  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15000,
  });
}

interface AuthFixtures {
  testData: E2ETestDataManager;
  authenticatedPage: Page;
  authenticatedUser: AuthenticatedUser;
}

/**
 * Extended test fixture that provides:
 * - testData: Test data manager for creating organizations and users
 * - authenticatedPage: A page with an authenticated user session
 * - authenticatedUser: The user credentials used for authentication
 *
 * @example
 * ```ts
 * test('should show dashboard', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/dashboard');
 *   await expect(authenticatedPage.getByText('Dashboard')).toBeVisible();
 * });
 * ```
 */
export const test = testDataTest.extend<
  Omit<AuthFixtures, 'testData'> & { testData: E2ETestDataManager }
>({
  authenticatedUser: async ({ testData }, use) => {
    // Create an organization with a single admin user
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 0 },
    });

    await use({
      email: adminUser.email,
      password: adminUser.password,
      authUserId: adminUser.authUserId,
    });
  },

  authenticatedPage: async ({ page, authenticatedUser }, use) => {
    // Login through the actual UI with OTP
    await loginViaUI(page, authenticatedUser);

    await use(page);
  },
});

export { expect } from '@playwright/test';
