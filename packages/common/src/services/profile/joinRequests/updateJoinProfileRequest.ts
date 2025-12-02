import { db } from '@op/db/client';
import {
  EntityType,
  JoinProfileRequestStatus,
  joinProfileRequests,
  organizations,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import {
  CommonError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils';
import { getOrgAccessUser, getProfileAccessUser } from '../../access';
import type { JoinProfileRequestWithProfiles } from './createJoinProfileRequest';

/**
 * Updates the status of an existing join profile request to approved or rejected.
 * Only admin members of the target profile (or the owning organization) may perform this action.
 */
export const updateJoinProfileRequest = async ({
  user,
  requestProfileId,
  targetProfileId,
  status,
}: {
  user: User;
  requestProfileId: string;
  targetProfileId: string;
  status: JoinProfileRequestStatus.APPROVED | JoinProfileRequestStatus.REJECTED;
}): Promise<JoinProfileRequestWithProfiles> => {
  const [targetProfile, organization, profileUser] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, targetProfileId) }),
    db.query.organizations.findFirst({
      where: eq(organizations.profileId, targetProfileId),
    }),
    getProfileAccessUser({ user, profileId: targetProfileId }),
  ]);

  if (!targetProfile) {
    throw new ValidationError('Target profile not found');
  }

  // Authorization: User must be an admin member of the target profile OR the organization that owns it
  if (profileUser) {
    assertAccess({ profile: permission.ADMIN }, profileUser.roles);
  } else if (organization) {
    const orgUser = await getOrgAccessUser({
      user,
      organizationId: organization.id,
    });

    if (!orgUser) {
      throw new UnauthorizedError(
        'You must be a member of this organization to manage join requests',
      );
    }

    assertAccess({ profile: permission.ADMIN }, orgUser.roles);
  } else {
    throw new UnauthorizedError(
      'You must be a member of this profile to manage join requests',
    );
  }

  // Find the existing request
  const existingRequest = await db.query.joinProfileRequests.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.requestProfileId, requestProfileId),
        eq(table.targetProfileId, targetProfileId),
      ),
  });

  if (!existingRequest) {
    throw new ValidationError('Join request not found');
  }

  // If status is unchanged, return the existing record with profiles
  if (existingRequest.status === status) {
    const requestProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, requestProfileId),
    });

    return {
      ...existingRequest,
      requestProfile: requestProfile as any,
      targetProfile: targetProfile as any,
    } as JoinProfileRequestWithProfiles;
  }

  const [updated] = await db
    .update(joinProfileRequests)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(joinProfileRequests.requestProfileId, requestProfileId),
        eq(joinProfileRequests.targetProfileId, targetProfileId),
      ),
    )
    .returning();

  if (!updated) {
    throw new CommonError('Failed to update join profile request');
  }

  const requestProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, requestProfileId),
  });

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
      where: (table, { eq }) => eq(table.profileId, requestProfileId),
    });

    if (requestingUser) {
      // Check if user is already a member of the target profile
      const existingMembership = await db.query.profileUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, requestingUser.authUserId),
            eq(table.profileId, targetProfileId),
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
              profileId: targetProfileId,
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
