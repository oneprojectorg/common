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
  try {
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

    console.log('DELETED DECISION', instanceId, user.id);

    return { success: true, deletedId: instanceId };
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error deleting decision:', error);
    throw new CommonError('Failed to delete decision');
  }
};
