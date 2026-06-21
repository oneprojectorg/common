import { type NormalizedRole, permission } from 'access-zones';

import type { AccessUser } from '../access';
import { assertProfileAccess } from './assertProfileAccess';

/**
 * {@link assertProfileAccess} for the common `{ profile: permission.ADMIN }`
 * check. Returns the caller's roles.
 *
 * @throws UnauthorizedError if the user lacks admin permission.
 */
export async function assertProfileAdmin({
  user,
  profileId,
}: {
  user?: AccessUser;
  profileId: string;
}): Promise<NormalizedRole[]> {
  return assertProfileAccess({
    user,
    profileId,
    permissions: { profile: permission.ADMIN },
  });
}
