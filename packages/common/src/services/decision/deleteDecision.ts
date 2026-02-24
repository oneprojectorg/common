import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser, getUserSession } from '../access';

export const deleteDecision = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user: User;
}) => {
  try {
    const [sessionUser, instance] = await Promise.all([
      getUserSession({ authUserId: user.id }),
      db.query.processInstances.findFirst({
        where: { id: instanceId },
      }),
    ]);

    const { user: dbUser } = sessionUser ?? {};

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    if (!instance) {
      throw new NotFoundError('Decision not found');
    }

    // Check if user is the owner or has admin access
    const isOwner = instance.ownerProfileId === dbUser.currentProfileId;

    if (!isOwner) {
      const instanceProfileUser = instance.profileId
        ? await getProfileAccessUser({
            user: { id: user.id },
            profileId: instance.profileId,
          })
        : undefined;

      const canDelete = checkPermission(
        [{ decisions: permission.DELETE }, { decisions: permission.ADMIN }],
        instanceProfileUser?.roles ?? [],
      );

      if (!canDelete) {
        throw new UnauthorizedError('Not authorized to delete this decision');
      }
    }

    if (!instance.profileId) {
      throw new CommonError('Decision profile not found');
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
