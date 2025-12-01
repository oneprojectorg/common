import { db } from '@op/db/client';
import { EntityType, joinProfileRequests, profiles } from '@op/db/schema';
import { inArray } from 'drizzle-orm';

import { CommonError, ValidationError } from '../../../utils';

/**
 * Creates a new request from one profile to join another profile.
 * Currently only allows user profiles to request to join organization profiles.
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

  const [profileRecords, existingRequest] = await Promise.all([
    db
      .select({ id: profiles.id, type: profiles.type })
      .from(profiles)
      .where(inArray(profiles.id, [requestProfileId, targetProfileId])),
    db.query.joinProfileRequests.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.requestProfileId, requestProfileId),
          eq(table.targetProfileId, targetProfileId),
        ),
    }),
  ]);

  const requestProfile = profileRecords.find(
    ({ id }) => id === requestProfileId,
  );
  const targetProfile = profileRecords.find(({ id }) => id === targetProfileId);

  if (!requestProfile || !targetProfile) {
    throw new ValidationError('One or both profiles do not exist');
  }

  // For now, only allow user/individual profiles to request to join organization profiles
  if (
    requestProfile.type !== EntityType.USER &&
    requestProfile.type !== EntityType.INDIVIDUAL
  ) {
    throw new ValidationError(
      'Only user profiles can request to join other profiles',
    );
  }

  if (targetProfile.type !== EntityType.ORG) {
    throw new ValidationError(
      'Join requests can only be made to organization profiles',
    );
  }

  if (existingRequest) {
    throw new CommonError('A join request already exists for this profile');
  }

  await db.insert(joinProfileRequests).values({
    requestProfileId,
    targetProfileId,
  });
};
