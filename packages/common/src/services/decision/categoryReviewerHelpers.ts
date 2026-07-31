import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';

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

  await assertInstanceProfileAccess({
    user,
    instance: {
      profileId: instance.profileId,
      ownerProfileId: instance.ownerProfileId,
    },
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  return instance;
}
