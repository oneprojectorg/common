import { createClient } from '@op/api/serverClient';
import { forbidden } from 'next/navigation';
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
 * For server components in walled-garden route groups: resolves a non-null user
 * or renders the forbidden screen. The `(main)` layout already gates the walled
 * garden, so this is a defensive fallback that also narrows the type to non-null.
 */
export const getRequiredUser = async () => {
  const user = await getUser();

  if (!user) {
    forbidden();
  }

  return user;
};
