import type { Page } from '@playwright/test';

import { type E2ETestDataManager, test as testDataTest } from './test-data';

/**
 * Get Supabase project ID from the URL environment variable.
 * Extracts the project ID from URLs like: https://[project-id].supabase.co
 */
function getSupabaseProjectId(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match?.[1]) {
    throw new Error(`Could not extract project ID from URL: ${url}`);
  }
  return match[1];
}

interface AuthenticatedUser {
  email: string;
  password: string;
  authUserId: string;
}

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
}

interface AuthFixtures {
  testData: E2ETestDataManager;
  authenticatedPage: Page;
  authenticatedUser: AuthenticatedUser;
}

/**
 * Signs in a user via Supabase REST API (password auth) and returns the session.
 * This bypasses the UI entirely for fast, reliable authentication.
 */
async function signInViaApi(user: {
  email: string;
  password: string;
}): Promise<SupabaseSession> {
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

  const session = (await response.json()) as SupabaseSession;
  return session;
}

/**
 * Extended test fixture that provides:
 * - testData: Test data manager for creating organizations and users
 * - authenticatedPage: A page with an authenticated user session
 * - authenticatedUser: The user credentials used for authentication
 *
 * Authentication works by:
 * 1. Getting a valid session via Supabase password auth API
 * 2. Injecting the session into localStorage before page load
 * 3. The useAuthUser hook (in E2E mode) reads from localStorage
 *
 * This requires NEXT_PUBLIC_E2E_TEST=true to be set (done in playwright.config.ts)
 *
 * @example
 * ```ts
 * test('should show dashboard', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/dashboard');
 *   await expect(authenticatedPage.getByText('Dashboard')).toBeVisible();
 * });
 * ```
 */
export const test = testDataTest.extend<
  Omit<AuthFixtures, 'testData'> & { testData: E2ETestDataManager }
>({
  authenticatedUser: async ({ testData }, use) => {
    // Create an organization with a single admin user
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 0 },
    });

    await use({
      email: adminUser.email,
      password: adminUser.password,
      authUserId: adminUser.authUserId,
    });
  },

  authenticatedPage: async ({ context, page, authenticatedUser }, use) => {
    // Get a valid session via Supabase API
    const session = await signInViaApi(authenticatedUser);

    const storageKey = `sb-${getSupabaseProjectId()}-auth-token`;

    // Build the cookie value in the format Supabase @supabase/ssr expects:
    // 1. Base64URL encode the JSON session
    // 2. Prefix with "base64-"
    // 3. Chunk if > 3180 chars (cookie size limit)
    const sessionJson = JSON.stringify(session);
    const base64Encoded = Buffer.from(sessionJson)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const base64Value = `base64-${base64Encoded}`;

    // Chunk the cookie value (max ~3180 chars per cookie to stay under 4KB limit)
    const CHUNK_SIZE = 3180;
    const chunks: string[] = [];
    for (let i = 0; i < base64Value.length; i += CHUNK_SIZE) {
      chunks.push(base64Value.slice(i, i + CHUNK_SIZE));
    }

    // Add cookies to the browser context - these will be sent with all requests
    // Using context.addCookies ensures they're sent at the browser level, not just in headers
    const cookiesToAdd = chunks.map((chunk, i) => ({
      name: chunks.length === 1 ? storageKey : `${storageKey}.${i}`,
      value: chunk,
      domain: 'localhost',
      path: '/',
    }));

    await context.addCookies(cookiesToAdd);

    // Also inject into localStorage for client-side auth
    await context.addInitScript(
      (args: { storageKey: string; sessionJson: string }) => {
        window.localStorage.setItem(args.storageKey, args.sessionJson);
        console.log('[E2E Auth] Session injected into localStorage');
      },
      { storageKey, sessionJson: JSON.stringify(session) },
    );

    // Navigate to home page (via /en/ to skip middleware locale redirect)
    await page.goto('/en/');
    await page.waitForLoadState('networkidle');

    await use(page);
  },
});

export { expect } from '@playwright/test';
