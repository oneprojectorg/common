import { db } from '@op/db/client';
import {
  EntityType,
  type JoinProfileRequest,
  type Profile,
  organizationUsers,
  organizations,
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
    // NOTE: In the future we might want to allow members of profiles to create requests
    db.query.users.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, user.id),
          eq(table.profileId, requestProfileId),
        ),
    }),
    // Check if user is already a member of the target organization.
    // NOTE: We're using organizationUsers instead of profileUsers because we're in between
    // memberships - the profile user membership (new) and the organization user membership (old).
    // After we migrate to profile users, this code should be changed to use profileUsers.
    db
      .select({ id: organizationUsers.id })
      .from(organizationUsers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationUsers.organizationId),
      )
      .where(
        and(
          eq(organizationUsers.authUserId, user.id),
          eq(organizations.profileId, targetProfileId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!requestProfile || !targetProfile) {
    throw new ValidationError('Request or target profile not found');
  }

  // Currently, only individual/user profiles can request to join organization profiles.
  // This may change in the future to support other profile type combinations.
  // NOTE: Profile type validation must come before authorization check
  // because it's a validation error (invalid input), not an authorization issue.
  const isRequestProfileIndividualOrUser =
    requestProfile.type === EntityType.INDIVIDUAL ||
    requestProfile.type === EntityType.USER;
  const isTargetProfileOrg = targetProfile.type === EntityType.ORG;

  if (!isRequestProfileIndividualOrUser) {
    throw new ValidationError(
      'Only individual or user profiles can create join requests',
    );
  }

  if (!isTargetProfileOrg) {
    throw new ValidationError(
      'Join requests can only be made to organization profiles',
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
