import { db } from '@op/db/client';
import {
  EntityType,
  type JoinProfileRequest,
  JoinProfileRequestStatus,
  type Profile,
  joinProfileRequests,
  organizationUsers,
  organizations,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { and, eq } from 'drizzle-orm';

import {
  CommonError,
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils';

export type JoinProfileRequestWithProfiles = JoinProfileRequest & {
  requestProfile: Profile;
  targetProfile: Profile;
};

/**
 * Creates a new request from one profile to join another profile.
 * Returns the join profile request with associated profiles.
 */
export const createJoinProfileRequest = async ({
  user,
  requestProfileId,
  targetProfileId,
}: {
  user: User;
  requestProfileId: string;
  targetProfileId: string;
}): Promise<JoinProfileRequestWithProfiles> => {
  // Prevent self-requests
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
      'You can only create join requests from your own profile',
    );
  }

  // Check if user is already a member of the target profile
  if (existingMembership) {
    throw new ValidationError('You are already a member of this profile');
  }

  if (existingRequest) {
    // If previously rejected, reset to pending with updated timestamp
    if (existingRequest.status === JoinProfileRequestStatus.REJECTED) {
      const [updated] = await db
        .update(joinProfileRequests)
        .set({
          status: JoinProfileRequestStatus.PENDING,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(joinProfileRequests.id, existingRequest.id))
        .returning();

      if (!updated) {
        throw new CommonError('Failed to update join profile request');
      }

      return {
        ...updated,
        requestProfile,
        targetProfile,
      };
    }
    throw new ConflictError('A join request already exists for this profile');
  }

  const [inserted] = await db
    .insert(joinProfileRequests)
    .values({
      requestProfileId,
      targetProfileId,
      // will default to "pending"
    })
    .returning();

  if (!inserted) {
    throw new CommonError('Failed to create join profile request');
  }

  return {
    ...inserted,
    requestProfile,
    targetProfile,
  };
};
