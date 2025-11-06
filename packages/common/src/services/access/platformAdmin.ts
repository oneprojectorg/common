import { platformAdminEmailDomain } from '@op/core';
import { db } from '@op/db/client';

import { UnauthorizedError } from '../../utils/error';

/**
 * Checks if a user has platform admin privileges based on email domain
 * Platform admins are identified by having an email address matching the configured admin domain
 */
export const isPlatformAdmin = async (authUserId: string): Promise<boolean> => {
  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.authUserId, authUserId),
  });

  if (!user?.email) {
    return false;
  }

  const emailDomain = user.email.split('@')[1];

  if (!emailDomain) {
    return false;
  }

  return platformAdminEmailDomain === emailDomain;
};

/**
 * Asserts that a user has platform admin access, throwing an error if they don't
 * Used as a guard in API routes that require platform admin privileges
 */
export const assertPlatformAdmin = async (
  authUserId: string,
): Promise<void> => {
  const isAdmin = await isPlatformAdmin(authUserId);

  if (!isAdmin) {
    throw new UnauthorizedError('Platform admin access required');
  }
};
