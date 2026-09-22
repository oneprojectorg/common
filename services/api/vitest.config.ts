import { coverageConfig } from '@op/vitest-config/coverage';
import { generateKeyPairSync } from 'node:crypto';
import { defaultExclude, defineConfig } from 'vitest/config';

// A throwaway ES256 key pair per run; tests derive the public key from it.
const { privateKey: TIPTAP_PRIVATE_KEY } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// Files that must keep per-file isolation: they register their own `vi.mock`
// factory, or assert against the shared mocks in `src/test/setup.ts`, and one
// registry per worker hands them whichever mock the first file installed.
const ISOLATED_FILES = [
  'src/middlewares/withLogger.test.ts',
  'src/routers/decision/instances/backfillReviewAssignments.test.ts',
  'src/routers/decision/instances/submitManualSelection.test.ts',
  'src/routers/decision/instances/transitionFromPhase.test.ts',
  'src/routers/decision/instances/transitionMonitor.test.ts',
  'src/routers/profile/invite.test.ts',
  'src/routers/profile/users/listUsers.test.ts',
  'src/routers/profile/users/removeUser.test.ts',
  'src/routers/translation/translateDecision.test.ts',
  'src/routers/translation/translatePosts.test.ts',
  'src/routers/translation/translateProposal.test.ts',
  'src/routers/translation/translateProposals.test.ts',
  'src/routers/translation/translateResources.test.ts',
  'src/routers/translation/translateRubric.test.ts',
];

// Test environment values - used for both `env` (runtime) and `define` (compile-time)
const TEST_ENV = {
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
  // Each worker holds its own pool, so the app default of 10 leaves Postgres no
  // headroom for the rest of the Supabase stack and the auth server starts
  // answering `Database error querying schema`.
  DB_POOL_MAX: '4',
  // TipTap Cloud credentials - required for collab mock to be invoked
  NEXT_PUBLIC_TIPTAP_APP_ID: 'test-tiptap-app',
  TIPTAP_SECRET: 'test-tiptap-secret',
  TIPTAP_PRIVATE_KEY,
  TIPTAP_ENVIRONMENT_ID: 'test-tiptap-env',
};

// Compile-time replacements for bundled test code.
const DEFINE = Object.fromEntries(
  Object.entries(TEST_ENV).map(([key, value]) => [
    `process.env.${key}`,
    JSON.stringify(value),
  ]),
);

// `globalSetup` is deliberately not in here: it migrates and seeds, so it must
// run once for the whole run rather than once per project.
const baseTestConfig = {
  coverage: coverageConfig(),
  environment: 'node' as const,
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  testTimeout: 30_000,
  pool: 'threads' as const,
  env: TEST_ENV,
};

export default defineConfig({
  test: {
    ...baseTestConfig,
    globalSetup: ['./src/test/globalSetup.ts'],
    maxWorkers: process.env.CI ? 4 : 2,
    projects: [
      {
        test: {
          ...baseTestConfig,
          name: 'shared',
          // One module graph per worker, not one per file: re-importing the
          // router tree per file cost more than the tests themselves.
          isolate: false,
          exclude: [...defaultExclude, ...ISOLATED_FILES],
        },
        resolve: { alias: { '@': './src' } },
        define: DEFINE,
      },
      {
        test: {
          ...baseTestConfig,
          name: 'isolated',
          isolate: true,
          include: ISOLATED_FILES,
        },
        resolve: { alias: { '@': './src' } },
        define: DEFINE,
      },
    ],
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  define: DEFINE,
});
