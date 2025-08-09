import { type SupabaseClient } from '@supabase/supabase-js';
import { supabaseTestClient } from './setup';

/**
 * Test utilities for Supabase integration tests
 */

/**
 * Clean up test data from tables after tests
 */
export async function cleanupTestData(tables: string[] = []) {
  if (!supabaseTestClient) {
    console.warn('Supabase test client not initialized');
    return;
  }

  const promises = tables.map(async (table) => {
    try {
      // First check if the table exists by trying to select from it
      const { error: selectError } = await supabaseTestClient.from(table).select('id').limit(1);
      
      if (selectError && selectError.message.includes('does not exist')) {
        // Table doesn't exist, skip cleanup
        return;
      }
      
      // Delete all records from test table using a more compatible approach
      const { error } = await supabaseTestClient.from(table).delete().gte('created_at', '1970-01-01');
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
export async function createTestUser(email: string, password: string = 'testpassword123') {
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
export async function signInTestUser(email: string, password: string = 'testpassword123') {
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

  const { data: { session }, error } = await supabaseTestClient.auth.getSession();
  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return session;
}

/**
 * Insert test data into a table
 */
export async function insertTestData<T = any>(table: string, data: T | T[]) {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
  }

  const { data: result, error } = await supabaseTestClient
    .from(table)
    .insert(data)
    .select();

  if (error) {
    throw new Error(`Failed to insert test data into ${table}: ${error.message}`);
  }

  return result;
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
export async function waitForSupabase(maxRetries: number = 10, delayMs: number = 1000) {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      const { error } = await supabaseTestClient.from('_test_connection').select('*').limit(1);
      // If we get here without throwing, connection is working
      return true;
    } catch (err) {
      if (i === maxRetries - 1) {
        throw new Error('Supabase not ready after maximum retries');
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return false;
}

/**
 * Reset database to clean state (removes all data from specified tables)
 */
export async function resetTestDatabase(tablesToReset: string[] = []) {
  if (!supabaseTestClient) {
    throw new Error('Supabase test client not initialized');
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
  
  // Also clear auth users in test mode
  try {
    const { data: users } = await supabaseTestClient.auth.admin.listUsers();
    if (users?.users) {
      const deletePromises = users.users.map(user => 
        supabaseTestClient.auth.admin.deleteUser(user.id)
      );
      await Promise.allSettled(deletePromises);
    }
  } catch (err) {
    console.warn('Could not reset auth users (this is normal if not using service role key)');
  }
}