import { cache } from '@op/cache';
import { getAllowListUser, isNetworkEmailDomain } from '@op/common';

/** Cached closed-network ("walled garden") membership: `@oneproject.org` or an allow-list entry. */
export const getNetworkMembership = async (
  email?: string | null,
): Promise<boolean> => {
  if (!email) {
    return false;
  }

  if (isNetworkEmailDomain(email)) {
    return true;
  }

  const allowed = await cache({
    type: 'allowList',
    params: [email.toLowerCase()],
    fetch: () => getAllowListUser({ email: email.toLowerCase() }),
    options: {
      ttl: 30 * 60 * 1000,
    },
  });

  return Boolean(allowed);
};
