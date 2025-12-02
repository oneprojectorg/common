import { db } from '@op/db/client';
import { EntityType, JoinProfileRequest, profiles } from '@op/db/schema';
import { eq } from 'drizzle-orm';

import { ValidationError } from '../../../utils';

export type JoinProfileRequestResult = Pick<
  JoinProfileRequest,
  | 'id'
  | 'requestProfileId'
  | 'targetProfileId'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Gets an existing join profile request between two profiles.
 * Returns null if no request exists.
 */
export const getJoinProfileRequest = async ({
  requestProfileId,
  targetProfileId,
}: {
  requestProfileId: string;
  targetProfileId: string;
}): Promise<JoinProfileRequestResult | null> => {
  // Prevent self-requests
  if (requestProfileId === targetProfileId) {
    throw new ValidationError('Cannot check join request for same profile');
  }

  const [requestProfile, targetProfile] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(profiles.id, requestProfileId),
      columns: { type: true },
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.id, targetProfileId),
      columns: { type: true },
    }),
  ]);

  // Validate profile types - only individual/user can request to join org
  const isRequestProfileIndividualOrUser =
    requestProfile?.type === EntityType.INDIVIDUAL ||
    requestProfile?.type === EntityType.USER;
  const isTargetProfileOrg = targetProfile?.type === EntityType.ORG;

  if (!isRequestProfileIndividualOrUser || !isTargetProfileOrg) {
    throw new ValidationError(
      'Only individual or user profiles can request to join organization profiles',
    );
  }

  const existingRequest = await db.query.joinProfileRequests.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.requestProfileId, requestProfileId),
        eq(table.targetProfileId, targetProfileId),
      ),
  });

  if (!existingRequest) {
    return null;
  }

  return existingRequest;
};
