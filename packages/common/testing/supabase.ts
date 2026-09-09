import { createClient } from '@supabase/supabase-js';

import { TEST_USER_DEFAULT_PASSWORD } from './constants';
import { supabaseTestAdminClient, supabaseTestClient } from './setup';

export { supabaseTestClient, supabaseTestAdminClient } from './setup';
export { TEST_USER_DEFAULT_PASSWORD };

/**
 * Create a test user and return the user object
 */
export async function createTestUser(
  email: string,
  password: string = TEST_USER_DEFAULT_PASSWORD,
) {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
  }

  const { data, error } = await supabaseTestClient.auth.signUp({
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

/**
 * Sign in as a test user
 */
export async function signInTestUser(
  email: string,
  password: string = TEST_USER_DEFAULT_PASSWORD,
) {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
  }

  const { data, error } = await supabaseTestClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return data;
}

/**
 * Sign out current user
 */
export async function signOutTestUser() {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
  }

  const { error } = await supabaseTestClient.auth.signOut();
  if (error) {
    throw new Error(`Failed to sign out: ${error.message}`);
  }
}

/**
 * Get current test user session
 */
export async function getCurrentTestSession() {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
  }

  const {
    data: { session },
  } = await supabaseTestClient.auth.getSession();

  return session;
}

/**
 * Create an isolated Supabase client for a test.
 * This client won't interfere with other tests running in parallel.
 * Safe for concurrent test execution.
 */
export function createIsolatedTestClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/**
 * Sign in a user with an isolated client and return the session.
 * This is safe for parallel test execution as it doesn't affect global state.
 *
 * @returns An object containing the isolated client and session
 */
export async function createIsolatedSession(
  email: string,
  password: string = TEST_USER_DEFAULT_PASSWORD,
) {
  const client = createIsolatedTestClient();

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(`Failed to sign in user: ${error?.message}`);
  }

  return {
    client,
    session: data.session,
  };
}

/**
 * Insert test data into a table
 * Uses admin client to bypass RLS policies
 */
export async function insertTestData<T>(table: string, data: T | T[]) {
  if (!supabaseTestAdminClient) {
    throw new Error('Supabase admin test client not initialized');
  }

  const response = await supabaseTestAdminClient
    .from(table)
    .insert(data)
    .select();

  if (response.error) {
    throw new Error(
      `Failed to insert test data into ${table}: ${response.error.message || response.error.code || response.error.hint || JSON.stringify(response.error)}`,
    );
  }

  return response.data;
}
