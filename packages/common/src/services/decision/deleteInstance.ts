import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser, getUserSession } from '../access';
import { assertOrganizationByProfileId } from '../assert';

export interface DeleteInstanceResult {
  success: boolean;
  action: 'deleted' | 'archived';
  instanceId: string;
}

export const deleteInstance = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user: User;
}): Promise<DeleteInstanceResult> => {
  try {
    const [sessionUser, existingInstance] = await Promise.all([
      getUserSession({ authUserId: user.id }),
      db.query.processInstances.findFirst({
        where: eq(processInstances.id, instanceId),
      }),
    ]);

    const { user: dbUser } = sessionUser ?? {};

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    if (!existingInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // Get organization from process instance owner profile
    const organization = await assertOrganizationByProfileId(
      existingInstance.ownerProfileId,
    );

    // Get user's organization membership and roles
    const orgUser = await getOrgAccessUser({
      user,
      organizationId: organization.id,
    });

    const hasPermissions = checkPermission(
      { decisions: permission.ADMIN },
      orgUser?.roles ?? [],
    );

    // Only the process owner or admin can delete the instance
    const isProcessOwner =
      existingInstance.ownerProfileId === dbUser.currentProfileId;

    if (!hasPermissions && !isProcessOwner) {
      throw new UnauthorizedError(
        'Not authorized to delete this process instance',
      );
    }

    // Check if any state transitions have occurred
    const transitions = await db.query.stateTransitionHistory.findFirst({
      where: eq(stateTransitionHistory.processInstanceId, instanceId),
    });

    if (transitions) {
      // Transitions exist - archive instead of delete
      const [archivedInstance] = await db
        .update(processInstances)
        .set({
          status: ProcessStatus.ARCHIVED,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(processInstances.id, instanceId))
        .returning();

      if (!archivedInstance) {
        throw new CommonError('Failed to archive process instance');
      }

      return {
        success: true,
        action: 'archived',
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
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error deleting process instance:', error);
    throw new CommonError('Failed to delete process instance');
  }
};
