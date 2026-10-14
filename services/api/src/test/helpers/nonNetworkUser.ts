import type { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { randomUUID } from 'crypto';

import { createTestUser } from '../supabase-utils';

/** Creates a confirmed user outside the walled garden and returns their email. */
export const createNonNetworkUser = async (
  testData: TestDecisionsDataManager,
) => {
  const email = `non-network-${randomUUID()}@example.com`;
  const { user } = await createTestUser(email);
  if (!user) {
    throw new Error(`Failed to create non-network user: ${email}`);
  }
  testData.trackAuthUserForCleanup(user.id);
  const userRecord = await db.query.users.findFirst({
    where: { authUserId: user.id },
  });
  if (userRecord?.profileId) {
    testData.trackProfileForCleanup(userRecord.profileId);
  }
  return email;
};
