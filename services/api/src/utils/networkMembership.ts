import { cache } from '@op/cache';
import { isNetworkMember } from '@op/common';

/**
 * Cached closed-network ("walled garden") membership lookup for an email.
 * Wraps the shared {@link isNetworkMember} predicate so both the API network
 * gate and the account encoder share one cache entry per email.
 */
export const getCachedNetworkMembership = (
  email?: string | null,
): Promise<boolean> =>
  cache<boolean>({
    type: 'networkMembership',
    params: [email?.toLowerCase()],
    fetch: () => isNetworkMember({ email }),
    options: {
      ttl: 30 * 60 * 1000,
    },
  });
