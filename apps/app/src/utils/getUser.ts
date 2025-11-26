import { createClient } from '@op/api/serverClient';
import { cache } from 'react';

/**
 * Cached user fetch for server components.
 * React's cache() dedupes calls within a single request,
 * so multiple components can call this without extra API requests.
 */
export const getUser = cache(async () => {
  const client = await createClient();
  return client.account.getMyAccount();
});
