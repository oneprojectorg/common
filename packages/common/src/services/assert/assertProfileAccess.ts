import {
  type AccessZonePermissionInput,
  type NormalizedRole,
  checkPermission,
} from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';

/**
 * Resolves the caller's *effective* roles on a profile (their own grant unioned
 * with any public grant) and asserts the given permissions, returning the
 * roles so callers can reuse them.
 *
 * Roles are the honest shape for an access decision: an anonymous caller on a
 * public process has access without any identity row to fabricate, so this
 * returns `{ roles }` rather than a synthetic profile-access user.
 *
 * @param notMemberMessage - Optional message for the thrown exception when the
 *   caller has no role on the profile. Defaults to 'Not authorized'.
 * @throws UnauthorizedError if the caller has no role on the profile or their
 *   roles don't satisfy the permissions — every denial throws the same
 *   exception type (only the message differs when `notMemberMessage` is given).
 */
export async function assertProfileAccess({
  user,
  profileId,
  permissions,
  notMemberMessage,
}: {
  user?: AccessUser;
  profileId: string;
  permissions: AccessZonePermissionInput;
  notMemberMessage?: string;
}): Promise<{ roles: NormalizedRole[] }> {
  const roles = await getProfileAccessRoles({ user, profileId });

  if (roles.length === 0) {
    throw new UnauthorizedError(notMemberMessage ?? 'Not authorized');
  }

  if (!checkPermission(permissions, roles)) {
    throw new UnauthorizedError('Not authorized');
  }

  return { roles };
}
