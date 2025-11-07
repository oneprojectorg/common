import { platformAdminEmailDomain } from '@op/core';
import { db } from '@op/db/client';

import { UnauthorizedError } from '../../utils/error';

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

export const assertPlatformAdmin = async (
  authUserId: string,
): Promise<void> => {
  const isAdmin = await isPlatformAdmin(authUserId);

  if (!isAdmin) {
    throw new UnauthorizedError('Platform admin access required');
  }
};
