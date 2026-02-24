import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';

export const deleteDecision = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user: User;
}) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new NotFoundError('Decision not found');
  }

  if (!instance.profileId) {
    throw new CommonError('Decision profile not found');
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });

  const canDelete = checkPermission(
    [{ decisions: permission.DELETE }, { decisions: permission.ADMIN }],
    profileUser?.roles ?? [],
  );

  if (!canDelete) {
    throw new UnauthorizedError('Not authorized to delete this decision');
  }

  // Delete the decision's profile, which cascades to the instance and all related data
  const [deletedProfile] = await db
    .delete(profiles)
    .where(eq(profiles.id, instance.profileId))
    .returning();

  if (!deletedProfile) {
    throw new CommonError('Failed to delete decision');
  }
};
