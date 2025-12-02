import { db } from '@op/db/client';
import { EntityType, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { UnauthorizedError, ValidationError } from '../../../utils';
import { JoinProfileRequestWithProfiles } from './createJoinProfileRequest';

/**
 * Gets an existing join profile request between two profiles.
 * Returns the join profile request with associated profiles, or null if no request exists.
 */
export const getJoinProfileRequest = async ({
  user,
  requestProfileId,
  targetProfileId,
}: {
  user: User;
  requestProfileId: string;
  targetProfileId: string;
}): Promise<JoinProfileRequestWithProfiles | null> => {
  // Prevent self-requests
  if (requestProfileId === targetProfileId) {
    throw new ValidationError('Cannot check join request for same profile');
  }

  const [requestProfile, targetProfile, requestingUser] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(profiles.id, requestProfileId),
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.id, targetProfileId),
    }),
    // Check if user owns this profile (their individual profile)
    // NOTE: In the future we might want to allow members of profiles to get requests
    db.query.users.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, user.id),
          eq(table.profileId, requestProfileId),
        ),
    }),
  ]);

  if (!requestProfile || !targetProfile) {
    throw new ValidationError('Request or target profile not found');
  }

  // Authorization: User must own the requesting profile
  if (!requestingUser) {
    throw new UnauthorizedError(
      'You can only view join requests from your own profile',
    );
  }

  // Validate profile types - only individual/user can request to join org
  const isRequestProfileIndividualOrUser =
    requestProfile.type === EntityType.INDIVIDUAL ||
    requestProfile.type === EntityType.USER;
  const isTargetProfileOrg = targetProfile.type === EntityType.ORG;

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

  return {
    ...existingRequest,
    requestProfile,
    targetProfile,
  };
};
