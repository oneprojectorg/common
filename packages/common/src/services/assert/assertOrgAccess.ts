import { type AccessZonePermissionInput, checkPermission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { type OrgUserWithNormalizedRoles, getOrgAccessUser } from '../access';

/**
 * Fetches the user's roles on an organization and asserts the given
 * permissions, returning the resolved org-access user so callers can reuse it.
 *
 * @param notMemberMessage - Optional message for the thrown exception when the
 *   user has no role on the organization. Defaults to 'Not authorized'.
 * @throws UnauthorizedError if the user is not a member of the organization or
 *   their roles don't satisfy the permissions — every denial throws the same
 *   exception type (only the message differs when `notMemberMessage` is given).
 */
export async function assertOrgAccess({
  user,
  organizationId,
  permissions,
  notMemberMessage,
}: {
  user: { id: string };
  organizationId: string;
  permissions: AccessZonePermissionInput;
  notMemberMessage?: string;
}): Promise<OrgUserWithNormalizedRoles> {
  const orgUser = await getOrgAccessUser({ user, organizationId });

  if (!orgUser) {
    throw new UnauthorizedError(notMemberMessage ?? 'Not authorized');
  }

  if (!checkPermission(permissions, orgUser.roles)) {
    throw new UnauthorizedError('Not authorized');
  }

  return orgUser;
}
