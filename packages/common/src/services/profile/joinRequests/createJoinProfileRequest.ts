import { db } from '@op/db/client';
import {
  EntityType,
  JoinProfileRequestStatus,
  joinProfileRequests,
  profiles,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';

import { ConflictError, ValidationError } from '../../../utils';

/**
 * Creates a new request from one profile to join another profile.
 */
export const createJoinProfileRequest = async ({
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

  const [requestProfile, targetProfile, existingRequest] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(profiles.id, requestProfileId),
      columns: { type: true },
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.id, targetProfileId),
      columns: { type: true },
    }),
    db.query.joinProfileRequests.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.requestProfileId, requestProfileId),
          eq(table.targetProfileId, targetProfileId),
        ),
    }),
  ]);

  // Currently, only individual/user profiles can request to join organization profiles.
  // This may change in the future to support other profile type combinations.
  const isRequestProfileIndividualOrUser =
    requestProfile?.type === EntityType.INDIVIDUAL ||
    requestProfile?.type === EntityType.USER;
  const isTargetProfileOrg = targetProfile?.type === EntityType.ORG;

  if (!isRequestProfileIndividualOrUser || !isTargetProfileOrg) {
    throw new ValidationError(
      'Only individual or user profiles can request to join organization profiles',
    );
  }

  if (existingRequest) {
    // If previously rejected, reset to pending with updated timestamp
    if (existingRequest.status === JoinProfileRequestStatus.REJECTED) {
      await db
        .update(joinProfileRequests)
        .set({
          status: JoinProfileRequestStatus.PENDING,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(joinProfileRequests.id, existingRequest.id));
      return;
    }
    throw new ConflictError('A join request already exists for this profile');
  }

  await db.insert(joinProfileRequests).values({
    requestProfileId,
    targetProfileId,
  });
};
