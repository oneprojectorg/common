import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';

/** Loads a process instance and asserts the caller holds decisions ADMIN on it. */
export async function assertCategoryReviewerAdmin({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User | undefined;
}): Promise<{ profileId: string | null; ownerProfileId: string | null }> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true, ownerProfileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  // No org fallback: admin access comes from a grant on the instance's own
  // profile, which legacy instances may not have — fail closed there.
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  return instance;
}
