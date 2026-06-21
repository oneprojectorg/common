import {
  type AccessZonePermissionInput,
  type NormalizedRole,
  checkPermission,
} from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';

/**
 * Asserts the caller's effective roles on a profile satisfy `permissions`,
 * returning those roles. Bare `NormalizedRole[]`, matching {@link
 * assertInstanceProfileAccess} and {@link getProfileAccessRoles}.
 *
 * @param notMemberMessage - Message thrown when the caller has no role.
 *   Defaults to 'Not authorized'.
 * @throws UnauthorizedError on any denial (only the message differs when
 *   `notMemberMessage` is given).
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
}): Promise<NormalizedRole[]> {
  const roles = await getProfileAccessRoles({ user, profileId });

  if (roles.length === 0) {
    throw new UnauthorizedError(notMemberMessage ?? 'Not authorized');
  }

  if (!checkPermission(permissions, roles)) {
    throw new UnauthorizedError('Not authorized');
  }

  return roles;
}
