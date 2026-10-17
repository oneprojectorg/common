import { db, eq, inArray } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import {
  afterTestTransaction,
  inTestTransaction,
  runInTestTransaction,
} from '@op/db/test';
import {
  AuthError,
  type SupabaseClient,
  createClient,
} from '@supabase/supabase-js';
import { aroundEach, beforeAll, beforeEach, vi } from 'vitest';

import './taskMeta';

// Mocks a test asserts against live in `./mocks` — see ./mocks/README.md.

vi.mock('@op/common/src/services/profile/utils');
vi.mock('@op/analytics/client', () => ({
  default: () => ({
    capture() {},
    identify() {},
    async shutdown() {},
  }),
}));
vi.mock('@op/collab', async () => import('@op/collab/testing'));
vi.mock('deepl-node', async () => (await import('./mocks/deepl')).deeplMock);

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
vi.mock(
  '@op/logging',
  async () => (await import('./mocks/logging')).loggingMock,
);

// Test environment configuration for isolated test Supabase instance
// These values are defined in testing/vitest.ts and injected via process.env
const TEST_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const TEST_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_ANON_KEY!;

let testSupabase: SupabaseClient;
let testSupabaseAdmin: SupabaseClient;

// Export test client for use in tests
export let supabaseTestClient: SupabaseClient;
// Export admin client for test setup/teardown (bypasses RLS)
export let supabaseTestAdminClient: SupabaseClient;

/**
 * Mock platformAdminEmails that treats all @oneproject.org emails as platform admins.
 * Helps with testing platform admin functionality without hardcoding specific emails.
 */
const mockPlatformAdminEmails = {
  has(email: string): boolean {
    return email.toLowerCase().endsWith('@oneproject.org');
  },
};

// Mock the event system to avoid Inngest API calls in tests
vi.mock('@op/events', async () =>
  (await import('./mocks/events')).eventsMock(),
);

// Mock @op/core to return test environment values and use mock platformAdminEmails
vi.mock('@op/core', async () => {
  const actual = await vi.importActual('@op/core');
  return {
    ...actual,
    // Use mock that treats @oneproject.org as platform admin domain
    platformAdminEmails: mockPlatformAdminEmails,
    // Mock the URL config to use test environment
    OPURLConfig: vi.fn(() => ({
      IS_PRODUCTION: false,
      IS_STAGING: false,
      IS_PREVIEW: false,
      IS_DEVELOPMENT: false,
      IS_LOCAL: true,
      // `src/links.ts` builds an httpLink from this and rejects an undefined url.
      TRPC_URL: 'http://127.0.0.1:55399/api/v1/trpc',
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
  deferAuthDeletesPastTheRollback(testSupabaseAdmin);
});

const DEFERRED_DELETE = new AuthError(
  'Deferred until the test transaction is rolled back',
  202,
  'deferred_delete',
);

const deferAuthDeletesPastTheRollback = (client: SupabaseClient) => {
  const admin = client.auth.admin;
  const deleteUser = admin.deleteUser.bind(admin);
  admin.deleteUser = (id, shouldSoftDelete) =>
    inTestTransaction()
      ? afterTestTransaction(async () => {
          const owned = await db
            .select({ profileId: users.profileId })
            .from(users)
            .where(eq(users.authUserId, id));
          await deleteUser(id, shouldSoftDelete);
          const profileIds = owned.flatMap(({ profileId }) =>
            profileId ? [profileId] : [],
          );
          if (profileIds.length > 0) {
            await db.delete(profiles).where(inArray(profiles.id, profileIds));
          }
        }).then(() => ({ data: { user: null }, error: DEFERRED_DELETE }))
      : deleteUser(id, shouldSoftDelete);
};

// Setup test environment for each test
beforeEach(async () => {
  vi.clearAllMocks();
});

const TEST_TRANSACTION_TIMEOUT_MS = 60_000;

if (process.env.TEST_DB_TRANSACTIONS !== 'off') {
  aroundEach(async (runTest, _context, suite) => {
    if (suite.file.meta.testTransactions === 'off') {
      await runTest();
      return;
    }
    await runInTestTransaction(async () => {
      await runTest();
    });
  }, TEST_TRANSACTION_TIMEOUT_MS);
}
