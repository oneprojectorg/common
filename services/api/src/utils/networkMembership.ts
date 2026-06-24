import { cache } from '@op/cache';
import { getAllowListUser } from '@op/common';
import { allowedEmailDomains } from '@op/core';

/** Cached closed-network ("walled garden") membership: a network email domain or an allow-list entry. */
export const getNetworkMembership = async (
  email?: string | null,
): Promise<boolean> => {
  if (!email) {
    return false;
  }

  const domain = email.toLowerCase().split('@')[1];

  if (domain && allowedEmailDomains.includes(domain)) {
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
