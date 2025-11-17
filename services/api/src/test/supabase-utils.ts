import type { Session } from '@supabase/supabase-js';
import { TContext } from 'src/types';

import { supabaseTestAdminClient, supabaseTestClient } from './setup';

export { supabaseTestClient, supabaseTestAdminClient } from './setup';

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

  const { createServerClient } = await import('@supabase/ssr');
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
 * This allows the server-side Supabase client to authenticate properly without the JWT hack
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
    time: Date.now(),
    isServerSideCall: true,
  };
}

/**
 * Test utilities for Supabase integration tests
 */

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
  password: string = 'testpassword123',
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
  password: string = 'testpassword123',
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
 * Get a JWT token for a specific user without affecting the global client state.
 * This is safe to use in concurrent tests as it creates an isolated client.
 */
export async function getJWTForUser(
  email: string,
  password: string = 'testpassword123',
) {
  const { createClient } = await import('@supabase/supabase-js');

  const TEST_SUPABASE_URL = 'http://127.0.0.1:55321';
  const TEST_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

  // Create an isolated client that won't affect other tests
  const isolatedClient = createClient(
    TEST_SUPABASE_URL,
    TEST_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false, // Don't persist session to avoid affecting other tests
        autoRefreshToken: false,
      },
    },
  );

  const { data: signInData, error: signInError } =
    await isolatedClient.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError || !signInData.session) {
    throw new Error(`Failed to sign in user for JWT: ${signInError?.message}`);
  }

  return signInData.session.access_token;
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

/**
 * Execute a raw SQL query (useful for complex setup/teardown)
 */
export async function executeTestSQL(sql: string, params: any[] = []) {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
  }

  const { data, error } = await supabaseTestClient.rpc('execute_sql', {
    sql_query: sql,
    sql_params: params,
  });

  if (error) {
    console.warn(`SQL execution warning: ${error.message}`);
  }

  return { data, error };
}

/**
 * Wait for the Supabase instance to be ready
 */
export async function waitForSupabase(
  maxRetries: number = 10,
  delayMs: number = 1000,
) {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      await supabaseTestClient.from('_test_connection').select('*').limit(1);
      // If we get here without throwing, connection is working
      return true;
    } catch (err) {
      if (i === maxRetries - 1) {
        throw new Error('Supabase not ready after maximum retries');
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

/**
 * Reset database to clean state (removes all data from specified tables)
 * Uses admin client to bypass RLS policies
 */
export async function resetTestDatabase(tablesToReset: string[] = []) {
  if (!supabaseTestAdminClient) {
    throw new Error('Supabase admin test client not initialized');
  }

  // Default tables to reset if none specified
  const defaultTables = [
    'profiles',
    'organizations',
    'posts',
    'comments',
    // Add more default tables as needed
  ];

  const tables = tablesToReset.length > 0 ? tablesToReset : defaultTables;

  await cleanupTestData(tables);

  // Clear auth users using admin client
  try {
    const { data: users } =
      await supabaseTestAdminClient.auth.admin.listUsers();
    if (users?.users) {
      const deletePromises = users.users.map((user) =>
        supabaseTestAdminClient.auth.admin.deleteUser(user.id),
      );
      await Promise.allSettled(deletePromises);
    }
  } catch (err) {
    console.warn('Could not reset auth users:', err);
  }
}
