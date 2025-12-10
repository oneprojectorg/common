import { platformAdminEmails } from '@op/core';

/**
 * Checks if a user has platform admin privileges based on email allowlist
 * Platform admins are identified by having an email address in the allowlist
 */
export const isUserPlatformAdmin = (user: { email?: string | null }): boolean => {
  if (!user?.email) {
    return false;
  }

  return platformAdminEmails.has(user.email.toLowerCase());
};
