import { db, eq } from '@op/db/client';
import { ProcessStatus, processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { getProfileAccessUser } from '../access';

export interface DeleteInstanceResult {
  success: boolean;
  action: 'deleted' | 'cancelled';
  instanceId: string;
}

export const deleteInstance = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user: User;
}): Promise<DeleteInstanceResult> => {
  // Fetch existing instance
  const existingInstance = await db._query.processInstances.findFirst({
    where: (table, { eq }) => eq(table.id, instanceId),
  });

  if (!existingInstance) {
    throw new NotFoundError('Process instance not found');
  }

  const { profileId } = existingInstance;
  if (!profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  // Check user has admin access on the decision instance's profile and check for transitions in parallel
  const [profileUser, transitions] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    db._query.stateTransitionHistory.findFirst({
      where: (table, { eq }) => eq(table.processInstanceId, instanceId),
    }),
  ]);

  assertAccess({ profile: permission.ADMIN }, profileUser?.roles ?? []);

  if (transitions) {
    // Transitions exist - cancel instead of delete
    const [cancelledInstance] = await db
      .update(processInstances)
      .set({
        status: ProcessStatus.CANCELLED,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(processInstances.id, instanceId))
      .returning();

    if (!cancelledInstance) {
      throw new CommonError('Failed to cancel process instance');
    }

    return {
      success: true,
      action: 'cancelled',
      instanceId,
    };
  }

  // No transitions - safe to hard delete
  const [deletedInstance] = await db
    .delete(processInstances)
    .where(eq(processInstances.id, instanceId))
    .returning();

  if (!deletedInstance) {
    throw new CommonError('Failed to delete process instance');
  }

  return {
    success: true,
    action: 'deleted',
    instanceId,
  };
};
