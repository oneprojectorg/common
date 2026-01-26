import {
  type CreateOrganizationResult,
  TEST_USER_DEFAULT_PASSWORD,
  createOrganization,
} from '@op/test';
import type { Page } from '@playwright/test';
import { test as base } from '@playwright/test';
import {
  type Session,
  type SupabaseClient,
  createClient,
} from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { TEST_USER_DEFAULT_PASSWORD };

interface AuthenticatedUser {
  email: string;
  password: string;
  authUserId: string;
}

interface WorkerFixtures {
  workerStorageState: string;
  workerAuthUser: AuthenticatedUser;
  workerOrg: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
}

interface TestFixtures {
  authenticatedPage: Page;
  authenticatedUser: AuthenticatedUser;
  org: CreateOrganizationResult;
}

function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getSupabaseProjectId(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  const parsed = new URL(url);

  if (
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname.startsWith('127.') ||
    parsed.hostname === 'localhost' ||
    parsed.hostname.endsWith('.local')
  ) {
    const segment = parsed.hostname.split('.')[0];
    if (!segment) {
      throw new Error(`Could not extract project ID from URL: ${url}`);
    }
    return segment;
  }

  const match = parsed.hostname.match(/^([^.]+)\.supabase\.co$/);
  if (!match?.[1]) {
    throw new Error(`Could not extract project ID from URL: ${url}`);
  }
  return match[1];
}

async function signInViaApi(user: {
  email: string;
  password: string;
}): Promise<Session> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  const response = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to sign in via API: ${response.status} - ${errorBody}`,
    );
  }

  return (await response.json()) as Session;
}

/**
 * Extended test fixture with authenticated browser state.
 * Each worker gets a unique test account, authenticates once via API,
 * and saves session cookies to storageState for all tests to reuse.
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  supabaseAdmin: [
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    async ({}, use) => {
      const client = createSupabaseAdminClient();
      await use(client);
    },
    { scope: 'worker' },
  ],

  workerOrg: [
    async ({ supabaseAdmin }, use, workerInfo) => {
      const testId = `w${workerInfo.workerIndex}`;
      const result = await createOrganization({
        testId,
        supabaseAdmin,
        users: { admin: 1, member: 0 },
      });

      await use(result);
    },
    { scope: 'worker' },
  ],

  workerAuthUser: [
    async ({ workerOrg }, use) => {
      await use({
        email: workerOrg.adminUser.email,
        password: TEST_USER_DEFAULT_PASSWORD,
        authUserId: workerOrg.adminUser.authUserId,
      });
    },
    { scope: 'worker' },
  ],

  workerStorageState: [
    async ({ workerAuthUser }, use, workerInfo) => {
      const id = workerInfo.workerIndex;
      const authDir = path.join(__dirname, '../playwright/.auth');
      const fileName = path.join(authDir, `${id}.json`);

      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      const session = await signInViaApi(workerAuthUser);

      const storageKey = `sb-${getSupabaseProjectId()}-auth-token`;
      const sessionJson = JSON.stringify(session);
      const base64Encoded = Buffer.from(sessionJson)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const base64Value = `base64-${base64Encoded}`;

      const CHUNK_SIZE = 3180;
      const chunks: string[] = [];
      for (let i = 0; i < base64Value.length; i += CHUNK_SIZE) {
        chunks.push(base64Value.slice(i, i + CHUNK_SIZE));
      }

      const cookies = chunks.map((chunk, i) => ({
        name: chunks.length === 1 ? storageKey : `${storageKey}.${i}`,
        value: chunk,
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      }));

      const storageState = {
        cookies,
        origins: [
          {
            origin: 'http://localhost:3100',
            localStorage: [
              {
                name: storageKey,
                value: sessionJson,
              },
            ],
          },
        ],
      };

      fs.writeFileSync(fileName, JSON.stringify(storageState, null, 2));

      await use(fileName);

      if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
      }
    },
    { scope: 'worker' },
  ],

  storageState: async ({ workerStorageState }, use) => {
    await use(workerStorageState);
  },

  authenticatedUser: async ({ workerAuthUser }, use) => {
    await use(workerAuthUser);
  },

  org: async ({ workerOrg }, use) => {
    await use(workerOrg);
  },

  authenticatedPage: async ({ page }, use) => {
    await use(page);
  },
});

export { expect } from '@playwright/test';
