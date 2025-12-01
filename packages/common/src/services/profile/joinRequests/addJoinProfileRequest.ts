import { db } from '@op/db/client';
import { joinProfileRequests } from '@op/db/schema';

import { CommonError, ValidationError } from '../../../utils';

/**
 * Creates a new request from one profile to join another profile.
 *
 * @throws {ValidationError} If requestProfileId equals targetProfileId (self-request)
 * @throws {CommonError} If a request already exists between these profiles
 */
export const addJoinProfileRequest = async ({
  requestProfileId,
  targetProfileId,
}: {
  requestProfileId: string;
  targetProfileId: string;
}): Promise<void> => {
  // Prevent self-requests
  if (requestProfileId === targetProfileId) {
    throw new ValidationError('Cannot request to join your own profile');
  }

  // Check if a request already exists
  const existingRequest = await db.query.joinProfileRequests.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.requestProfileId, requestProfileId),
        eq(table.targetProfileId, targetProfileId),
      ),
  });

  if (existingRequest) {
    throw new CommonError('A join request already exists for this profile');
  }

  // Create the join request (status defaults to 'pending')
  await db.insert(joinProfileRequests).values({
    requestProfileId,
    targetProfileId,
  });
};
