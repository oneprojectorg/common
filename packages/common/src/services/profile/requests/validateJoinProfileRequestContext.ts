import { db, getTableColumns } from '@op/db/client';
import {
  EntityType,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { and, eq, inArray } from 'drizzle-orm';

import { UnauthorizedError, ValidationError } from '../../../utils';
import { JoinProfileRequestContext } from './types';

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

  const [profilesWithJoins, existingRequest] = await Promise.all([
    // Fetch both profiles with authorization/membership checks via JOINs
    // - requestingUserId: non-null if user owns the request profile
    // - membershipId: non-null if user is already a member of the target org
    db
      .select({
        ...getTableColumns(profiles),
        requestingUserId: users.id,
        membershipId: organizationUsers.id,
      })
      .from(profiles)
      .leftJoin(
        users,
        and(eq(users.profileId, profiles.id), eq(users.authUserId, user.id)),
      )
      // NOTE: We're using organizationUsers instead of profileUsers because we're in between
      // memberships - the profile user membership (new) and the organization user membership (old).
      // After we migrate to profile users, this code should be changed to use profileUsers.
      .leftJoin(organizations, eq(organizations.profileId, profiles.id))
      .leftJoin(
        organizationUsers,
        and(
          eq(organizationUsers.organizationId, organizations.id),
          eq(organizationUsers.authUserId, user.id),
        ),
      )
      .where(inArray(profiles.id, [requestProfileId, targetProfileId])),

    db._query.joinProfileRequests.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.requestProfileId, requestProfileId),
          eq(table.targetProfileId, targetProfileId),
        ),
    }),
  ]);

  const requestProfileRow = profilesWithJoins.find(
    (profile) => profile.id === requestProfileId,
  );
  const targetProfileRow = profilesWithJoins.find(
    (profile) => profile.id === targetProfileId,
  );

  if (!requestProfileRow || !targetProfileRow) {
    throw new ValidationError('Request or target profile not found');
  }

  const isRequestingUser = !!requestProfileRow.requestingUserId;
  const existingMembership = !!targetProfileRow.membershipId;

  // Extract profile data (excluding join columns)
  const {
    requestingUserId: _requestProfileRequestingUserId,
    membershipId: _requestProfileMembershipId,
    ...requestProfile
  } = requestProfileRow;
  const {
    requestingUserId: _targetProfileRequestingUserId,
    membershipId: _targetProfileMembershipId,
    ...targetProfile
  } = targetProfileRow;

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
  if (!isRequestingUser) {
    throw new UnauthorizedError(
      'You can only manage join requests from your own profile',
    );
  }

  return {
    requestProfile,
    targetProfile,
    existingRequest,
    existingMembership,
  };
};
