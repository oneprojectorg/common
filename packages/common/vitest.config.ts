import { defineConfig } from 'vitest/config';

// Reuse the same isolated test Supabase instance as services/api
const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  SUPABASE_URL: 'http://127.0.0.1:55321',
  SUPABASE_SERVICE_ROLE:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
};

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30_000,
    pool: 'threads',
    env: TEST_ENV,
  },
  define: Object.fromEntries(
    Object.entries(TEST_ENV).map(([key, value]) => [
      `process.env.${key}`,
      JSON.stringify(value),
    ]),
  ),
});
