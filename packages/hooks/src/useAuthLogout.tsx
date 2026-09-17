'use client';

import { clearPersistedQueryCache } from '@op/api/client';
import type { AuthError } from '@op/supabase/lib';
import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

import nukeCookies from './utils/nukeCookies';

const useAuthLogout: () => UseMutationResult<
  { error: AuthError | null },
  Error,
  void
> = () => {
  const logout = useMutation<{ error: AuthError | null }, Error, void>({
    mutationKey: ['session', 'logout'],
    mutationFn: async () => {
      const createSBBrowserClient = (await import('@op/supabase/client'))
        .createSBBrowserClient;
      const supabase = createSBBrowserClient();

      const locData = await supabase.auth.signOut({ scope: 'local' });

      nukeCookies();

      // The full-page navigation below tears down the in-memory cache, but
      // not the copy the persister keeps in localStorage — that one outlives
      // the session and would be restored for whoever signs in next.
      await clearPersistedQueryCache();

      // No in-place cache update (neither getMyAccount invalidation nor an
      // auth-user refetch): both would re-render the still-mounted authed
      // tree with a dead session. Callers must follow up with a full-page
      // navigation, which tears down the client cache wholesale.
      if (locData.error) {
        throw new Error(locData.error.message);
      }

      return locData;
    },
  });

  return logout;
};

export default useAuthLogout;
