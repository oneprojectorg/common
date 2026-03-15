import { createClient } from '@op/api/serverClient';
import { cache } from 'react';

const IS_E2E = process.env.E2E === 'true';

/**
 * Cached user fetch for server components.
 */
const getUserInner = async () => {
  const client = await createClient();
  return client.account.getMyAccount();
};

export const getUser = IS_E2E ? getUserInner : cache(getUserInner);
