import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';

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
    throw new NotFoundError('Decision', instanceId);
  }

  if (!instance.profileId) {
    throw new CommonError('Decision profile not found');
  }

  await assertProfileAccess({ user, profileId: instance.profileId }, [
    { decisions: permission.DELETE },
    { decisions: permission.ADMIN },
  ]);

  // Delete the decision's profile, which cascades to the instance and all related data
  const [deletedProfile] = await db
    .delete(profiles)
    .where(eq(profiles.id, instance.profileId))
    .returning();

  if (!deletedProfile) {
    throw new CommonError('Failed to delete decision');
  }
};
