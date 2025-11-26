import { createClient } from '@op/api/serverClient';
import { cache } from 'react';

/**
 * Cached user fetch for server components.
 */
export const getUser = cache(async () => {
  const client = await createClient();
  return client.account.getMyAccount();
});
