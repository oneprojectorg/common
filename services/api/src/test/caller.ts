import { createIsolatedSession } from '@op/common/testing';
import { createServerClient } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';

import { appRouter } from '../routers';
import { createCallerFactory } from '../trpcFactory';
import type { TContext } from '../types';

const createCaller = createCallerFactory(appRouter);

/**
 * Converts a Supabase session into cookies using the actual Supabase SSR logic
 * This creates a server client, sets the session, and captures the resulting cookies
 */
export async function sessionToCookies(
  session: Session,
): Promise<Record<string, string>> {
  if (!session) {
    return {};
  }

  const cookies: Record<string, string> = {};

  // Create a temporary server client that will store cookies
  const tempClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
      cookies: {
        getAll: async () => {
          return Object.entries(cookies).map(([name, value]) => ({
            name,
            value,
          }));
        },
        setAll: async (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => {
            cookies[name] = value;
          });
        },
      },
    },
  );

  // Set the session - this will trigger the cookie storage
  await tempClient.auth.setSession(session);

  return cookies;
}

/**
 * Creates a test context with proper cookie handling for authentication
 * This allows the server-side Supabase client to authenticate properly in tests
 */
export async function createTestContextWithSession(
  session: Session | null,
): Promise<TContext> {
  const cookies = session ? await sessionToCookies(session) : {};

  return {
    req: {
      headers: { get: () => '127.0.0.1' },
      url: 'http://localhost:3000/api/trpc',
    } as any,
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    requestId: 'test-request-id',
    getCookies: () => cookies,
    getCookie: (name: string) => cookies[name],
    setCookie: ({ name, value }: { name: string; value: string }) => {
      cookies[name] = value;
    },
    registerMutationChannels: () => {},
    registerQueryChannels: () => {},
    time: Date.now(),
    isServerSideCall: true,
  };
}

/**
 * Creates a tRPC caller authenticated as the given user.
 */
export async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}
