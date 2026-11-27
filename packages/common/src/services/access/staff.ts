import { allowedEmailDomains } from '@op/core';

import { isUserEmailPlatformAdmin } from './platformAdmin';

/** Checks if a user is staff: an email at one of the organization's domains, or a platform admin. */
export const isUserEmailStaff = (userEmail: string): boolean => {
  const parts = userEmail.toLowerCase().split('@');
  const domain = parts.length === 2 ? parts[1] : undefined;

  if (domain && allowedEmailDomains.includes(domain)) {
    return true;
  }

  return isUserEmailPlatformAdmin(userEmail);
};
