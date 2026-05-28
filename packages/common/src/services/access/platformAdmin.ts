import { platformAdminEmails } from '@op/core';

/**
 * Checks if a user has platform admin privileges based on email allowlist
 */
export const isUserEmailPlatformAdmin = (
  userEmail: string | null | undefined,
): boolean => {
  if (!userEmail) return false;
  return platformAdminEmails.has(userEmail.toLowerCase());
};
