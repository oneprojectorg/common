/**
 * Portable test user utilities that work in both Vitest and Playwright environments.
 * These functions accept a Supabase client as a parameter rather than relying on
 * global state from setup.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Default password used for test users.
 * This is the password that should be used when logging in via browser in E2E tests.
 * Must be strong enough to pass Supabase's password requirements (remote instances
 * may have stricter requirements than local dev instances).
 */
export const TEST_USER_DEFAULT_PASSWORD = 'Test_Password_123!';

/**
 * Create a test user using the provided Supabase client.
 * Uses auth.signUp which works with the anon key client.
 *
 * @param client - Supabase client to use for user creation
 * @param email - Email address for the new user
 * @param password - Password for the new user (defaults to TEST_USER_DEFAULT_PASSWORD)
 * @returns The created user data
 */
export async function createTestUser(
  client: SupabaseClient,
  email: string,
  password: string = TEST_USER_DEFAULT_PASSWORD,
) {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: undefined,
    },
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data;
}
