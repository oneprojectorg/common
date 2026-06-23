import { cache } from '@op/cache';
import { isNetworkMember } from '@op/common';

/**
 * Cached closed-network ("walled garden") membership lookup for an email.
 * Wraps the shared {@link isNetworkMember} predicate so both the API network
 * gate and the account encoder share one cache entry per email.
 *
 * Reuses the `allowList` cache type but with a `network-member` discriminator in
 * the key: the value here is a boolean, whereas legacy entries under
 * `['allowList', email]` cached the `AllowListUser` object — sharing the key
 * would deserialize a stale object where a boolean is expected. `Boolean()`
 * guards against any unexpected cached shape.
 */
export const getNetworkMembership = async (
  email?: string | null,
): Promise<boolean> =>
  Boolean(
    await cache<boolean>({
      type: 'allowList',
      params: ['network-member', email?.toLowerCase()],
      fetch: () => isNetworkMember({ email }),
      options: {
        ttl: 30 * 60 * 1000,
      },
    }),
  );
