import { createClient } from '@op/api/serverClient';
import { redirect } from 'next/navigation';
import { cache } from 'react';

/**
 * Cached user fetch for server components. Resolves null for public
 * (no-session) visitors.
 */
export const getUser = cache(async () => {
  const client = await createClient();
  return client.account.getMyAccount();
});

/**
 * For server components in auth-gated route groups: resolves a non-null user
 * or redirects to login (mirroring the middleware) if there is no session.
 */
export const getRequiredUser = async () => {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return user;
};
