import { createIsolatedSession } from '@op/common/testing';
import { createServerClient } from '@op/supabase/lib';
import type { Session } from '@supabase/supabase-js';

import { type RequestCookie, mockServerRequest } from './nextHeaders';

export { mockServerRequest } from './nextHeaders';

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
