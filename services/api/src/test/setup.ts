import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';

// Mock server-only modules before any other imports
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock('@axiomhq/nextjs', () => ({
  withAxiom: (fn: any) => fn,
  Logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));
vi.mock('@op/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Test environment configuration for isolated test Supabase instance
const TEST_SUPABASE_URL = 'http://127.0.0.1:55321'; // Test instance port
const TEST_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const TEST_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

let testSupabase: SupabaseClient;
let testSupabaseAdmin: SupabaseClient;

// Export test client for use in tests
export let supabaseTestClient: SupabaseClient;
// Export admin client for test setup/teardown (bypasses RLS)
export let supabaseTestAdminClient: SupabaseClient;

// Mock environment variables for testing
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', TEST_SUPABASE_URL);
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', TEST_SUPABASE_ANON_KEY);
vi.stubEnv('SUPABASE_URL', TEST_SUPABASE_URL);
vi.stubEnv('SUPABASE_ANON_KEY', TEST_SUPABASE_ANON_KEY);
vi.stubEnv('SUPABASE_SERVICE_ROLE', TEST_SUPABASE_SERVICE_ROLE_KEY);
vi.stubEnv('DATABASE_URL', TEST_DATABASE_URL);

// Mock @op/core to return test environment values
vi.mock('@op/core', async () => {
  const actual = await vi.importActual('@op/core');
  return {
    ...actual,
    // Mock the URL config to use test environment
    OPURLConfig: vi.fn(() => ({
      IS_PRODUCTION: false,
      IS_STAGING: false,
      IS_PREVIEW: false,
      IS_DEVELOPMENT: false,
      IS_LOCAL: true,
    })),
  };
});

// Global setup for all tests (per test file)
beforeAll(async () => {
  // Initialize test Supabase client (anon key for user operations)
  testSupabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true, // Enable session persistence for auth to work in tests
    },
  });

  // Initialize admin Supabase client (service role key bypasses RLS)
  testSupabaseAdmin = createClient(
    TEST_SUPABASE_URL,
    TEST_SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  // Make test clients available globally
  supabaseTestClient = testSupabase;
  supabaseTestAdminClient = testSupabaseAdmin;

  // Verify Supabase is running
  try {
    const { error } = await testSupabase.from('users').select('*').limit(1);
    if (
      error &&
      !error.message.includes('relation "_test_ping" does not exist')
    ) {
      console.warn('Supabase connection test failed:', error.message);
    }
  } catch (err) {
    console.warn(
      "Failed to connect to test Supabase instance. Make sure it's running on",
      TEST_SUPABASE_URL,
    );
    throw err;
  }
});

// Setup test environment for each test
beforeEach(async () => {
  vi.clearAllMocks();

  // Reset auth state for each test
  if (testSupabase) {
    await testSupabase.auth.signOut();
  }
});

// Global cleanup
afterAll(async () => {
  if (testSupabase) {
    await testSupabase.auth.signOut();
  }
});
