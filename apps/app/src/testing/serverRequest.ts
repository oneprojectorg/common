import { createIsolatedSession } from '@op/common/testing';
import { createServerClient } from '@op/supabase/lib';
import type { Session } from '@supabase/supabase-js';

type RequestCookie = { name: string; value: string };

/**
 * The cookies and headers a server component sees for the current request.
 * `mockServerRequest` swaps the pair for each test.
 */
let requestCookies: RequestCookie[] = [];
let requestHeaders = new Headers();

/**
 * Replacement for `next/headers`. Outside a Next.js request scope `cookies()`
 * and `headers()` throw, so an integration test that calls a server component
 * directly installs this at module top level:
 *
 * ```ts
 * vi.mock('next/headers', async () =>
 *   (await import('@/testing/serverRequest')).nextHeadersMock,
 * );
 * ```
 *
 * Then `signInAs` / `mockServerRequest` set the request per test.
 */
export const nextHeadersMock = {
  cookies: async () => ({
    getAll: () => requestCookies,
    get: (name: string) =>
      requestCookies.find((cookie) => cookie.name === name),
    has: (name: string) =>
      requestCookies.some((cookie) => cookie.name === name),
    set: () => {
      throw new Error('A server component cannot set cookies');
    },
  }),
  headers: async () => requestHeaders,
};

/**
 * Sets the request a server component under test runs in.
 */
export const mockServerRequest = ({
  cookies = [],
  headers = {},
}: {
  cookies?: RequestCookie[];
  headers?: Record<string, string>;
} = {}) => {
  requestCookies = cookies;
  requestHeaders = new Headers(headers);
};

/**
 * Converts a Supabase session into the auth cookies the server client reads,
 * with the SSR client's own encoding (chunking included), so the server-side
 * tRPC caller authenticates exactly as it does for a browser request.
 */
export const sessionToCookies = async (
  session: Session,
): Promise<RequestCookie[]> => {
  const cookies = new Map<string, string>();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            cookies.set(name, value);
          }
        },
      },
    },
  );

  await client.auth.setSession(session);

  return Array.from(cookies, ([name, value]) => ({ name, value }));
};

/**
 * Signs in an existing test user and makes the current request carry their
 * session. A server component called after this sees that user.
 */
export const signInAs = async (email: string) => {
  const { session } = await createIsolatedSession(email);
  mockServerRequest({ cookies: await sessionToCookies(session) });
};
