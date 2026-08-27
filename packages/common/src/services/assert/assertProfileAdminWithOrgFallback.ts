import { type NormalizedRole, checkPermission, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import type { AccessUser } from '../access';
// The access↔assert barrels are mutually dependent, so every assert that reads
// a value from `../access` closes a cycle — assertProfileAccess,
// assertProfileAdmin and assertOrgAccess all sit in the same one. Untangling
// the barrels is its own change; defining this beside its dependency in
// `../access` instead breaks module init across the API.
// fallow-ignore-next-line circular-dependency
import { getProfileAccessRolesWithOrgFallback } from '../access';

/**
 * {@link assertProfileAdmin} for a profile that may belong to an organization.
 * Org grants live on `organizationUsers` rather than `profileUsers`, so the
 * profile-only lookup behind `assertProfileAdmin` never sees an org admin on
 * their own org's profile. Returns the caller's roles.
 *
 * A personal profile carries no role row for its own owner, so this denies the
 * owner of their personal profile — pair it with an own-profile check, the
 * same way `assertProfileAccess` has to be.
 *
 * @param notAdminMessage - Message thrown on denial. Defaults to 'Not authorized'.
 * @throws UnauthorizedError if the caller is not an admin of the profile.
 */
export async function assertProfileAdminWithOrgFallback({
  user,
  profileId,
  notAdminMessage,
}: {
  user?: AccessUser;
  profileId: string;
  notAdminMessage?: string;
}): Promise<NormalizedRole[]> {
  const roles = await getProfileAccessRolesWithOrgFallback({ user, profileId });

  if (!checkPermission({ profile: permission.ADMIN }, roles)) {
    throw new UnauthorizedError(notAdminMessage ?? 'Not authorized');
  }

  return roles;
}
