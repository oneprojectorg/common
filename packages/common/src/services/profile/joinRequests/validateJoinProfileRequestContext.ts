import { db } from '@op/db/client';
import {
  EntityType,
  type JoinProfileRequest,
  type Profile,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { UnauthorizedError, ValidationError } from '../../../utils';

export type JoinProfileRequestWithProfiles = JoinProfileRequest & {
  requestProfile: Profile;
  targetProfile: Profile;
};

export type JoinProfileRequestContext = {
  requestProfile: Profile;
  targetProfile: Profile;
  existingRequest: JoinProfileRequest | undefined;
  existingMembership: boolean;
};

/**
 * Fetches and validates the context needed for join profile request operations.
 * Performs authorization and profile type validation.
 */
export const validateJoinProfileRequestContext = async ({
  user,
  requestProfileId,
  targetProfileId,
}: {
  user: User;
  requestProfileId: string;
  targetProfileId: string;
}): Promise<JoinProfileRequestContext> => {
  if (requestProfileId === targetProfileId) {
    throw new ValidationError('Cannot request to join your own profile');
  }

  const [
    requestProfile,
    targetProfile,
    existingRequest,
    requestingUser,
    existingMembership,
  ] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(profiles.id, requestProfileId),
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.id, targetProfileId),
    }),
    db.query.joinProfileRequests.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.requestProfileId, requestProfileId),
          eq(table.targetProfileId, targetProfileId),
        ),
    }),
    // Check if user owns this profile (their individual profile)
    // NOTE: In the future we might want to allow members of profiles to manage requests
    db.query.users.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, user.id),
          eq(table.profileId, requestProfileId),
        ),
    }),

    // Check if user is already a member of the target profile
    db.query.profileUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, user.id),
          eq(table.profileId, targetProfileId),
        ),
    }),
  ]);

  if (!requestProfile || !targetProfile) {
    throw new ValidationError('Request or target profile not found');
  }

  // Currently, only individual/user profiles can request to join organization profiles.
  // This may change in the future to support other profile type combinations.
  const isRequestProfileIndividualOrUser =
    requestProfile.type === EntityType.INDIVIDUAL ||
    requestProfile.type === EntityType.USER;
  const isTargetProfileOrg = targetProfile.type === EntityType.ORG;

  if (!isRequestProfileIndividualOrUser || !isTargetProfileOrg) {
    throw new ValidationError(
      'Only individual or user profiles can request to join organization profiles',
    );
  }

  // Authorization: User must own the requesting profile
  if (!requestingUser) {
    throw new UnauthorizedError(
      'You can only manage join requests from your own profile',
    );
  }

  return {
    requestProfile,
    targetProfile,
    existingRequest,
    existingMembership: !!existingMembership,
  };
};
