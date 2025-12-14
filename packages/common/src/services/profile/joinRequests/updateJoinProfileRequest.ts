import { db } from '@op/db/client';
import {
  EntityType,
  JoinProfileRequestStatus,
  joinProfileRequests,
  organizationUserToAccessRoles,
  organizationUsers,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { CommonError, ValidationError } from '../../../utils';
import { assertProfile } from '../../assert';
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
  const { targetProfile, organization } = await assertTargetProfileAdminAccess({
    user,
    targetProfileId: existingRequest.targetProfileId,
  });

  // assertTargetProfileAdminAccess throws if organization is not found
  if (!organization) {
    throw new ValidationError('Target organization not found');
  }

  // Fetch the request profile
  const requestProfile = await assertProfile({
    id: existingRequest.requestProfileId,
  });

  // If status is unchanged, return the existing record with profiles
  if (existingRequest.status === status) {
    return {
      ...existingRequest,
      requestProfile,
      targetProfile,
    };
  }

  const [updated] = await db
    .update(joinProfileRequests)
    .set({ status })
    .where(eq(joinProfileRequests.id, requestId))
    .returning();

  if (!updated) {
    throw new CommonError('Failed to update join profile request');
  }

  // If approved, create profile membership for the requesting user
  if (status === JoinProfileRequestStatus.APPROVED) {
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
      // Check if user is already a member of the target organization.
      // NOTE: We're using organizationUsers instead of profileUsers because we're in between
      // memberships - the profile user membership (new) and the organization user membership (old).
      // After we migrate to profile users, this code should be changed to use profileUsers.
      const existingMembership = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, requestingUser.authUserId),
            eq(table.organizationId, organization.id),
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
          // Create the organization membership
          const [newOrgUser] = await tx
            .insert(organizationUsers)
            .values({
              authUserId: requestingUser.authUserId,
              organizationId: organization.id,
              email: requestingUser.email,
              name: requestingUser.name,
            })
            .returning();

          // Assign the Member role to the new organization user
          // NOTE: We start with Member role, but this can be configured in the future
          // to allow specifying a different role during the approval process
          if (newOrgUser) {
            await tx.insert(organizationUserToAccessRoles).values({
              organizationUserId: newOrgUser.id,
              accessRoleId: memberRole.id,
            });
          }
        });
      }
    }
  }

  return {
    ...updated,
    requestProfile,
    targetProfile,
  };
};
