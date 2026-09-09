import { fileURLToPath } from 'node:url';

// Test environment values - used for both `env` (runtime) and `define` (compile-time)
export const TEST_ENV = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  SUPABASE_URL: 'http://127.0.0.1:55321',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  SUPABASE_SERVICE_ROLE:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
  // TipTap Cloud credentials - required for collab mock to be invoked
  NEXT_PUBLIC_TIPTAP_APP_ID: 'test-tiptap-app',
  TIPTAP_SECRET: 'test-tiptap-secret',
};

const harnessFile = (name: string) =>
  fileURLToPath(new URL(name, import.meta.url));

/**
 * Vitest options every integration project shares. `globalSetup` and
 * `setupFiles` resolve against this file so each consumer only passes its root.
 */
export const defineIntegrationProject = ({ root }: { root: string }) => ({
  test: {
    root,
    environment: 'node' as const,
    globals: true,
    globalSetup: [harnessFile('./globalSetup.ts')],
    setupFiles: [harnessFile('./setup.ts')],
    testTimeout: 30_000,
    maxWorkers: process.env.CI ? 1 : 2,
    pool: 'threads' as const,
    env: TEST_ENV,
  },
  // Compile-time replacements for bundled test code
  define: Object.fromEntries(
    Object.entries(TEST_ENV).map(([key, value]) => [
      `process.env.${key}`,
      JSON.stringify(value),
    ]),
  ),
});
