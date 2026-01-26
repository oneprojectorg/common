import { createServerClient } from '@supabase/ssr';
import { type Session, createClient } from '@supabase/supabase-js';

import type { TContext } from '../types';
import { TEST_USER_DEFAULT_PASSWORD } from './helpers/test-user-utils';
import { supabaseTestAdminClient, supabaseTestClient } from './setup';

export { supabaseTestClient, supabaseTestAdminClient } from './setup';
export { TEST_USER_DEFAULT_PASSWORD } from './helpers/test-user-utils';

/**
 * Converts a Supabase session into cookies using the actual Supabase SSR logic
 * This creates a server client, sets the session, and captures the resulting cookies
 */
export async function sessionToCookies(
  session: Session,
): Promise<Record<string, string>> {
  if (!session) {
    return {};
  }

  const cookies: Record<string, string> = {};

  // Create a temporary server client that will store cookies
  const tempClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
      cookies: {
        getAll: async () => {
          return Object.entries(cookies).map(([name, value]) => ({
            name,
            value,
          }));
        },
        setAll: async (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => {
            cookies[name] = value;
          });
        },
      },
    },
  );

  // Set the session - this will trigger the cookie storage
  await tempClient.auth.setSession(session);

  return cookies;
}

/**
 * Creates a test context with proper cookie handling for authentication
 * This allows the server-side Supabase client to authenticate properly in tests
 */
export async function createTestContextWithSession(
  session: Session | null,
): Promise<TContext> {
  const cookies = session ? await sessionToCookies(session) : {};

  return {
    req: {
      headers: { get: () => '127.0.0.1' },
      url: 'http://localhost:3000/api/trpc',
    } as any,
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    requestId: 'test-request-id',
    getCookies: () => cookies,
    getCookie: (name: string) => cookies[name],
    setCookie: ({ name, value }: { name: string; value: string }) => {
      cookies[name] = value;
    },
    registerMutationChannels: () => {},
    registerQueryChannels: () => {},
    time: Date.now(),
    isServerSideCall: true,
  };
}

/**
 * Clean up test data from tables after tests
 * Uses admin client to bypass RLS policies
 */
export async function cleanupTestData(tables: string[] = []) {
  if (!supabaseTestAdminClient) {
    console.warn('Supabase admin test client not initialized');
    return;
  }

  const promises = tables.map(async (table) => {
    try {
      // First check if the table exists by trying to select from it
      const { error: selectError } = await supabaseTestAdminClient
        .from(table)
        .select('id')
        .limit(1);

      if (selectError && selectError.message.includes('does not exist')) {
        // Table doesn't exist, skip cleanup
        return;
      }

      // Delete all records from test table using admin client (bypasses RLS)
      const { error } = await supabaseTestAdminClient
        .from(table)
        .delete()
        .gte('created_at', '1970-01-01');
      if (error && !error.message.includes('does not exist')) {
        console.warn(`Failed to cleanup table ${table}:`, error.message);
      }
    } catch (err) {
      console.warn(`Failed to cleanup table ${table}:`, err);
    }
  });

  await Promise.allSettled(promises);
}

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
export async function insertTestData<T = any>(table: string, data: T | T[]) {
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
