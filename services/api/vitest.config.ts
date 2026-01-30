import { defineConfig } from 'vitest/config';

// Default test environment values - used for local development
// In CI, these are overridden by environment variables from the workflow
const LOCAL_TEST_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  SUPABASE_URL: 'http://127.0.0.1:55321',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  SUPABASE_SERVICE_ROLE:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
};

// Merge with existing env vars (CI values take precedence)
const TEST_ENV = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    LOCAL_TEST_ENV.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    LOCAL_TEST_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL ?? LOCAL_TEST_ENV.SUPABASE_URL,
  SUPABASE_ANON_KEY:
    process.env.SUPABASE_ANON_KEY ?? LOCAL_TEST_ENV.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE:
    process.env.SUPABASE_SERVICE_ROLE ?? LOCAL_TEST_ENV.SUPABASE_SERVICE_ROLE,
  DATABASE_URL: process.env.DATABASE_URL ?? LOCAL_TEST_ENV.DATABASE_URL,
  // TipTap Cloud credentials - required for collab mock to be invoked
  NEXT_PUBLIC_TIPTAP_APP_ID: 'test-tiptap-app',
  TIPTAP_SECRET: 'test-tiptap-secret',
};

// Check if running against remote Supabase (CI with rate limits)
const isRemoteSupabase = process.env.DATABASE_URL?.includes(
  'pooler.supabase.com',
);

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30_000,
    // Reduce parallelism when running against remote Supabase to avoid Auth rate limits
    // With 1 worker, tests within a file still run sequentially, avoiding burst limits
    maxWorkers: isRemoteSupabase ? 1 : '75%',
    pool: 'threads',
    env: TEST_ENV,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  // Compile-time replacements for bundled test code
  define: Object.fromEntries(
    Object.entries(TEST_ENV).map(([key, value]) => [
      `process.env.${key}`,
      JSON.stringify(value),
    ]),
  ),
});
