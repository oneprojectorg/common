'use client';

import type { AuthError } from '@op/supabase/lib';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DefinedUseQueryResult } from '@tanstack/react-query';

import useAuthUser from './useAuthUser';
import nukeCookies from './utils/nukeCookies';

const useAuthLogout: () => DefinedUseQueryResult<
  {
    error: AuthError | null;
  } | null,
  Error
> = () => {
  const user = useAuthUser();
  const queryClient = useQueryClient();
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

      await user.refetch();
      queryClient.invalidateQueries({
        queryKey: [['account', 'getMyAccount']],
      });

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
