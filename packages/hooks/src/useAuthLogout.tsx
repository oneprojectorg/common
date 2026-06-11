'use client';

import type { AuthError } from '@op/supabase/lib';
import { useQuery } from '@tanstack/react-query';
import type { DefinedUseQueryResult } from '@tanstack/react-query';

import nukeCookies from './utils/nukeCookies';

const useAuthLogout: () => DefinedUseQueryResult<
  {
    error: AuthError | null;
  } | null,
  Error
> = () => {
  const logout = useQuery<{
    error: AuthError | null;
  } | null>({
    queryKey: ['session', 'logout'],
    queryFn: async () => {
      const createSBBrowserClient = (await import('@op/supabase/client'))
        .createSBBrowserClient;
      const supabase = createSBBrowserClient();

      const locData = await supabase.auth.signOut({ scope: 'local' });

      nukeCookies();

      // No in-place cache update (neither getMyAccount invalidation nor an
      // auth-user refetch): both would re-render the still-mounted authed
      // tree with a dead session. Callers must follow up with a full-page
      // navigation, which tears down the client cache wholesale.
      if (locData.error) {
        throw new Error(locData.error.message);
      }

      return locData;
    },
    enabled: false,
    staleTime: 0,
    initialData: null,
  });

  return logout;
};

export default useAuthLogout;
