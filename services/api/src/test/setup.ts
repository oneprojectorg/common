import { vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Test environment configuration for isolated test Supabase instance
const TEST_SUPABASE_URL = 'http://127.0.0.1:55321';  // Test instance port
const TEST_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

let testSupabase: SupabaseClient;

// Export test client for use in tests
export let supabaseTestClient: SupabaseClient;

// Mock environment variables for testing
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', TEST_SUPABASE_URL);
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', TEST_SUPABASE_ANON_KEY);
vi.stubEnv('SUPABASE_URL', TEST_SUPABASE_URL);
vi.stubEnv('SUPABASE_ANON_KEY', TEST_SUPABASE_ANON_KEY);

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

// Global setup for all tests
beforeAll(async () => {
  // Initialize test Supabase client
  testSupabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
  });
  
  // Make test client available globally
  supabaseTestClient = testSupabase;
  
  // Run database migrations before tests
  await runMigrations();
  
  // Verify Supabase is running
  try {
    const { data, error } = await testSupabase.from('_test_ping').select('*').limit(1);
    if (error && !error.message.includes('relation "_test_ping" does not exist')) {
      console.warn('Supabase connection test failed:', error.message);
    }
  } catch (err) {
    console.warn('Failed to connect to test Supabase instance. Make sure it\'s running on', TEST_SUPABASE_URL);
  }
});

/**
 * Run database migrations and seed data using Drizzle
 */
async function runMigrations() {
  try {
    console.log('🔄 Running Drizzle migrations...');
    
    // Import necessary modules for running shell commands
    const { execSync } = await import('child_process');
    const path = await import('path');
    
    // Navigate to project root and run Drizzle migrations
    const projectRoot = path.resolve(process.cwd(), '../..');
    const migrationCommand = 'pnpm w:db migrate:test';
    
    execSync(migrationCommand, { 
      cwd: projectRoot,
      stdio: 'pipe' // Suppress output unless there's an error
    });
    
    console.log('✅ Drizzle migrations completed successfully');
    
    // Run seed command after migrations (optional)
    try {
      console.log('🌱 Running database seed...');
      const seedCommand = 'pnpm w:db seed:test';
      
      execSync(seedCommand, { 
        cwd: projectRoot,
        stdio: 'pipe' // Suppress output unless there's an error
      });
      
      console.log('✅ Database seed completed successfully');
    } catch (seedError: any) {
      // Seeding is optional - don't fail tests if it doesn't work
      console.warn('⚠️  Seeding warning:', seedError.message.split('\n')[0]);
      console.warn('   Tests will continue without seed data');
    }
  } catch (error: any) {
    // Don't fail tests if migrations/seeding fail - just warn
    console.warn('⚠️  Migration/seed warning:', error.message);
    console.warn('   Tests will continue, but some may fail if schema is outdated or data is missing');
  }
}

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
