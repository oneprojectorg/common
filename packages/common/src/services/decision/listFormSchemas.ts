import { db } from '@op/db/client';
import type { FormSchema } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';

/**
 * Lists the form schema rows of a decision instance, oldest first. Gated on
 * decisions READ on the instance (or the owning org), as `getProposal` is.
 */
export async function listFormSchemas({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<FormSchema[]> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true, ownerProfileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [
      { decisions: permission.READ },
      { decisions: permission.ADMIN },
    ],
  });

  return db.query.formSchemas.findMany({
    where: { processInstanceId },
    orderBy: { createdAt: 'asc', id: 'asc' },
  });
}
