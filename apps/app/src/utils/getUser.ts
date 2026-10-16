import { createClient } from '@op/api/serverClient';
import { isSafeRedirectPath } from '@op/common/client';
import { headers } from 'next/headers';
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
 * For server components that need a real account: resolves a signed-in,
 * non-anonymous user or redirects to login, returning here afterwards.
 */
export const getRequiredUser = async () => {
  const user = await getUser();

  if (!user || user.isAnonymous) {
    return redirectToLogin();
  }

  return user;
};

export async function redirectToLogin(): Promise<never> {
  const pathname = (await headers()).get('x-pathname');

  redirect(
    isSafeRedirectPath(pathname)
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : '/login',
  );
}
