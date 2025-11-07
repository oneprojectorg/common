import { platformAdminEmailDomain } from '@op/core';
import { User } from '@op/supabase/lib';

/**
 * Checks if a user has platform admin privileges based on email domain
 * Platform admins are identified by having an email address matching the configured admin domain
 */
export const isUserPlatformAdmin = (user: User): boolean => {
  if (!user?.email) {
    return false;
  }

  const emailDomain = user.email.split('@')[1];

  if (!emailDomain) {
    return false;
  }

  return platformAdminEmailDomain === emailDomain;
};
