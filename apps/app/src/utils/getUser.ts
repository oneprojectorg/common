import { cachePerRequest } from '@op/api/cachePerRequest';
import { createClient } from '@op/api/serverClient';
import '@tanstack/react-start/server-only';
import { redirect } from '@/lib/navigation';

/**
 * The signed-in account, fetched once per request however many loaders ask.
 * Resolves null for public (no-session) visitors.
 */
export const getUser = cachePerRequest(async () => {
  const client = await createClient();
  return client.account.getMyAccount();
});

/**
 * For loaders in auth-gated routes: resolves a non-null user or redirects to
 * login (mirroring the proxy) if there is no session.
 */
export const getRequiredUser = async () => {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return user;
};
