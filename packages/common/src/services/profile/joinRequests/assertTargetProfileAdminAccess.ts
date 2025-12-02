import { db } from '@op/db/client';
import {
  type Organization,
  type Profile,
  organizations,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { UnauthorizedError, ValidationError } from '../../../utils';
import { getOrgAccessUser, getProfileAccessUser } from '../../access';

export type TargetProfileAdminContext = {
  targetProfile: Profile;
  organization: Organization | undefined;
};

/**
 * Validates that a user has admin access to a target profile.
 * User must be an admin member of the target profile OR an admin of the organization that owns it.
 *
 * @throws ValidationError if target profile is not found
 * @throws UnauthorizedError if user doesn't have admin access
 */
export const assertTargetProfileAdminAccess = async ({
  user,
  targetProfileId,
}: {
  user: User;
  targetProfileId: string;
}): Promise<TargetProfileAdminContext> => {
  const [targetProfile, organization] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, targetProfileId) }),
    db.query.organizations.findFirst({
      where: eq(organizations.profileId, targetProfileId),
    }),
  ]);

  if (!targetProfile) {
    throw new ValidationError('Target profile not found');
  }

  if (!organization) {
    throw new UnauthorizedError('Target organization not found');
  }

  // Authorization: User must be an admin member of the target organization.
  // NOTE: We're using organizationUsers instead of profileUsers because we're in between
  // memberships - the profile user membership (new) and the organization user membership (old).
  // After we migrate to profile users, this code should be changed to use profileUsers.
  const orgUser = await getOrgAccessUser({
    user,
    organizationId: organization.id,
  });

  if (!orgUser) {
    throw new UnauthorizedError(
      'You must be a member of this organization to view join requests',
    );
  }

  assertAccess({ profile: permission.ADMIN }, orgUser.roles);

  return { targetProfile, organization };
};
