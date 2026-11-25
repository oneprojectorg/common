import { allowedEmailDomains } from '@op/core';

import { isUserEmailPlatformAdmin } from './platformAdmin';

/** Checks if a user works at OP: an OP email domain or a platform admin. */
export const isUserEmailOpStaff = (userEmail: string): boolean => {
  const parts = userEmail.toLowerCase().split('@');
  const domain = parts.length === 2 ? parts[1] : undefined;

  if (domain && allowedEmailDomains.includes(domain)) {
    return true;
  }

  return isUserEmailPlatformAdmin(userEmail);
};
