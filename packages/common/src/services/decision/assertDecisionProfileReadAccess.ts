import { db } from '@op/db/client';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { type AccessUser, assertInstanceProfileAccess } from '../access';

/**
 * Throws unless the user can read the decision whose profile is `profileId`,
 * with the same owning-organization fallback as `getInstance`.
 */
export async function assertDecisionProfileReadAccess({
  user,
  profileId,
}: {
  user: AccessUser;
  profileId: string;
}): Promise<void> {
  const instance = await db.query.processInstances.findFirst({
    where: { profileId },
    columns: { profileId: true, ownerProfileId: true },
  });

  if (!instance) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: { decisions: permission.READ },
  });
}
