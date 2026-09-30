import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { getProfileAccessRolesWithOrgFallback } from '../access';

/**
 * The one rule for "may this caller name this profile as a process's steward".
 *
 * Every path that writes `processInstances.stewardProfileId` goes through here —
 * create, duplicate and update — because a steward is rendered as who is running
 * the process and is a filter on the process lists, so a caller who could write
 * an arbitrary profile id could plant a process in a stranger's list under their
 * name.
 *
 * Org fallback because org grants live on `organizationUsers`, not
 * `profileUsers`; the caller's own profile skips the check, having no role row.
 */
export const assertCanStewardToProfile = async ({
  user,
  stewardProfileId,
  ownerProfileId,
}: {
  user: User;
  stewardProfileId: string;
  /** The caller's own profile, which needs no grant. */
  ownerProfileId: string;
}) => {
  if (stewardProfileId === ownerProfileId) {
    return;
  }

  const stewardRoles = await getProfileAccessRolesWithOrgFallback({
    user,
    profileId: stewardProfileId,
  });

  if (!checkPermission({ profile: permission.ADMIN }, stewardRoles)) {
    throw new UnauthorizedError(
      'Not authorized to steward a process to this profile',
    );
  }
};
