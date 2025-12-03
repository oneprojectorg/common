import { db } from '@op/db/client';
import {
  EntityType,
  JoinProfileRequestStatus,
  joinProfileRequests,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { CommonError, ValidationError } from '../../../utils';
import { assertTargetProfileAdminAccess } from './assertTargetProfileAdminAccess';
import type { JoinProfileRequestWithProfiles } from './createJoinProfileRequest';

/**
 * Updates the status of an existing join profile request to approved or rejected.
 * Only admin members of the target profile (or the owning organization) may perform this action.
 */
export const updateJoinProfileRequest = async ({
  user,
  requestId,
  status,
}: {
  user: User;
  /** The ID of the join profile request to update */
  requestId: string;
  status: JoinProfileRequestStatus.APPROVED | JoinProfileRequestStatus.REJECTED;
}): Promise<JoinProfileRequestWithProfiles> => {
  // Find the existing request by ID
  const existingRequest = await db.query.joinProfileRequests.findFirst({
    where: (table, { eq }) => eq(table.id, requestId),
  });

  if (!existingRequest) {
    throw new ValidationError('Join request not found');
  }

  // Check authorization - user must be admin of target profile
  const { targetProfile } = await assertTargetProfileAdminAccess({
    user,
    targetProfileId: existingRequest.targetProfileId,
  });

  // Fetch the request profile
  const requestProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, existingRequest.requestProfileId),
  });

  // If status is unchanged, return the existing record with profiles
  if (existingRequest.status === status) {
    return {
      ...existingRequest,
      requestProfile: requestProfile as any,
      targetProfile: targetProfile as any,
    } as JoinProfileRequestWithProfiles;
  }

  const [updated] = await db
    .update(joinProfileRequests)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(joinProfileRequests.id, requestId))
    .returning();

  if (!updated) {
    throw new CommonError('Failed to update join profile request');
  }

  // If approved, create profile membership for the requesting user
  if (status === JoinProfileRequestStatus.APPROVED && requestProfile) {
    // Validate that the request profile is an individual/user profile
    // Only individual/user profiles can join organization profiles
    const isRequestProfileIndividualOrUser =
      requestProfile.type === EntityType.INDIVIDUAL ||
      requestProfile.type === EntityType.USER;

    if (!isRequestProfileIndividualOrUser) {
      throw new ValidationError(
        'Only individual or user profiles can be approved to join organization profiles',
      );
    }

    // Get the owner of the requesting profile (their authUserId)
    const requestingUser = await db.query.users.findFirst({
      where: (table, { eq }) =>
        eq(table.profileId, existingRequest.requestProfileId),
    });

    if (requestingUser) {
      // Check if user is already a member of the target profile
      const existingMembership = await db.query.profileUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, requestingUser.authUserId),
            eq(table.profileId, existingRequest.targetProfileId),
          ),
      });

      // Only create membership if it doesn't already exist
      if (!existingMembership) {
        // TODO: We should find a better way to reference the Member role
        // rather than querying by name. Consider using a constant ID or
        // a more robust role resolution mechanism.
        const memberRole = await db.query.accessRoles.findFirst({
          where: (table, { eq }) => eq(table.name, 'Member'),
        });

        if (!memberRole) {
          throw new CommonError('Member role not found in the system');
        }

        await db.transaction(async (tx) => {
          // Create the profile membership
          const [newProfileUser] = await tx
            .insert(profileUsers)
            .values({
              authUserId: requestingUser.authUserId,
              profileId: existingRequest.targetProfileId,
              email: requestingUser.email,
              name: requestingUser.name,
            })
            .returning();

          // Assign the Member role to the new profile user
          // NOTE: We start with Member role, but this can be configured in the future
          // to allow specifying a different role during the approval process
          if (newProfileUser) {
            await tx.insert(profileUserToAccessRoles).values({
              profileUserId: newProfileUser.id,
              accessRoleId: memberRole.id,
            });
          }
        });
      }
    }
  }

  return {
    ...updated,
    requestProfile: requestProfile as any,
    targetProfile: targetProfile as any,
  } as JoinProfileRequestWithProfiles;
};
