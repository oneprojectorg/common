import { db, eq } from '@op/db/client';
import { ProcessStatus, processInstances, profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import type { DecisionInstanceData, PhaseOverride } from './schemas/instanceData';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

/**
 * Updates a decision process instance created from a DecisionSchemaDefinition template.
 */
export const updateInstanceFromTemplate = async ({
  instanceId,
  name,
  description,
  status,
  phases,
  user,
}: {
  instanceId: string;
  name?: string;
  description?: string;
  status?: ProcessStatus;
  /** Optional phase overrides (dates and settings) */
  phases?: PhaseOverride[];
  user: User;
}) => {
  const dbUser = await assertUserByAuthId(
    user.id,
    new UnauthorizedError('User must be authenticated'),
  );

  const ownerProfileId = dbUser.currentProfileId ?? dbUser.profileId;
  if (!ownerProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  // Fetch existing instance
  const existingInstance = await db.query.processInstances.findFirst({
    where: eq(processInstances.id, instanceId),
  });

  if (!existingInstance) {
    throw new NotFoundError('Process instance not found');
  }

  // Verify ownership
  if (existingInstance.ownerProfileId !== ownerProfileId) {
    throw new UnauthorizedError(
      'You do not have permission to update this process instance',
    );
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (description !== undefined) {
    updateData.description = description;
  }

  if (status !== undefined) {
    updateData.status = status;
  }

  // Apply phase overrides to existing instanceData
  if (phases && phases.length > 0) {
    const existingInstanceData =
      existingInstance.instanceData as DecisionInstanceData;

    // Create a map of phase overrides for quick lookup
    const overrideMap = new Map(
      phases.map((override) => [override.phaseId, override]),
    );

    // Apply overrides to existing phases
    const updatedPhases = existingInstanceData.phases.map((phase) => {
      const override = overrideMap.get(phase.phaseId);
      if (!override) {
        return phase;
      }

      return {
        ...phase,
        ...(override.startDate !== undefined && {
          startDate: override.startDate,
        }),
        ...(override.endDate !== undefined && { endDate: override.endDate }),
        ...(override.settings !== undefined && { settings: override.settings }),
      };
    });

    const updatedInstanceData: DecisionInstanceData = {
      ...existingInstanceData,
      phases: updatedPhases,
    };

    updateData.instanceData = updatedInstanceData;
  }

  // Only update if there's something to update
  if (Object.keys(updateData).length === 0) {
    // Nothing to update, just return the existing profile
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, existingInstance.profileId!),
      with: {
        processInstance: true,
      },
    });

    if (!profile) {
      throw new CommonError('Failed to fetch decision profile');
    }

    return profile;
  }

  // Update the instance
  const [updatedInstance] = await db
    .update(processInstances)
    .set(updateData)
    .where(eq(processInstances.id, instanceId))
    .returning();

  if (!updatedInstance) {
    throw new CommonError('Failed to update decision process instance');
  }

  // If phases were updated, update the corresponding transitions
  if (phases && phases.length > 0) {
    try {
      await updateTransitionsForProcess({ processInstance: updatedInstance });
    } catch (error) {
      // Log but don't fail instance update if transitions can't be updated
      console.error(
        'Failed to update transitions for process instance:',
        error,
      );
    }
  }

  // Fetch the profile with processInstance joined for the response
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, updatedInstance.profileId!),
    with: {
      processInstance: true,
    },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch updated decision profile');
  }

  return profile;
};
