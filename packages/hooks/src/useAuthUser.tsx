'use client';

import { useQuery } from '@tanstack/react-query';

import nukeCookies from './utils/nukeCookies';

import type { AuthError, User } from '@op/supabase/lib';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

interface Response {
  user: User | null;
  error: AuthError | null;
}

const useAuthUser: (
  options?: Omit<UseQueryOptions<Response, Error>, 'queryKey' | 'queryFn'>,
) => UseQueryResult<Response, Error> = (options) => {
  const user = useQuery<Response>({
    queryKey: ['session', 'user'],
    queryFn: async () => {
      const createSBBrowserClient = (await import('@op/supabase/client'))
        .createSBBrowserClient;
      const supabase = createSBBrowserClient();

      const locData = await supabase.auth.getUser();

      if (
        locData.error?.name !== 'AuthRetryableFetchError'
        && (locData.error || !locData.data?.user)
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
