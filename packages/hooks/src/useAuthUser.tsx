'use client';

import type { AuthError, User } from '@op/supabase/lib';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

import nukeCookies from './utils/nukeCookies';

interface Response {
  user: User | null;
  error: AuthError | null;
}

/**
 * In E2E test mode, we bypass the normal auth flow because:
 * 1. @supabase/ssr's PKCE flow doesn't work with injected cookies
 * 2. The singleton browser client caches empty auth state
 * 3. nukeCookies() deletes our test session during hydration
 *
 * Instead, we read the session directly from localStorage where
 * the test fixture injects it.
 */
async function getE2ETestUser(): Promise<Response> {
  // Check localStorage for E2E test session
  const storageKey = 'sb-yrpfxbnidfyrzmmsrfic-auth-token';
  const sessionJson = localStorage.getItem(storageKey);

  if (!sessionJson) {
    return { user: null, error: null };
  }

  try {
    const session = JSON.parse(sessionJson) as {
      user?: User;
      access_token?: string;
    };

    // Return the user from the session
    if (session.user) {
      return { user: session.user, error: null };
    }

    return { user: null, error: null };
  } catch {
    return { user: null, error: null };
  }
}

/**
 * Hook that returns the currently authenticated Supabase user.
 *
 * In E2E test mode (NEXT_PUBLIC_E2E_TEST=true), this uses a simplified
 * auth check that works with test session injection.
 */
const useAuthUser: (
  options?: Omit<UseQueryOptions<Response, Error>, 'queryKey' | 'queryFn'>,
) => UseQueryResult<Response, Error> = (options) => {
  const isE2ETest = process.env.NEXT_PUBLIC_E2E_TEST === 'true';

  const user = useQuery<Response>({
    queryKey: ['session', 'user'],
    queryFn: async () => {
      // In E2E test mode, use simplified auth that doesn't trigger nukeCookies
      if (isE2ETest) {
        return getE2ETestUser();
      }

      const createSBBrowserClient = (await import('@op/supabase/client'))
        .createSBBrowserClient;
      const supabase = createSBBrowserClient();

      const locData = await supabase.auth.getUser();

      if (
        locData.error?.name !== 'AuthRetryableFetchError' &&
        (locData.error || !locData.data?.user)
      ) {
        await supabase.auth.signOut({ scope: 'local' });
        nukeCookies();
      }

      return {
        user: locData.data.user ?? null,
        error: locData.error,
      };
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
    ...options,
  });

  return user;
};

export default useAuthUser;
