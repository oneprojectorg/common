import { db, eq } from '@op/db/client';
import { ProcessStatus, processInstances, profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { getProfileAccessUser } from '../access';
import type {
  DecisionInstanceData,
  PhaseOverride,
} from './schemas/instanceData';
import type { ProcessConfig } from './schemas/types';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

/**
 * Updates a decision process instance.
 */
export const updateDecisionInstance = async ({
  instanceId,
  name,
  description,
  status,
  config,
  phases,
  user,
}: {
  instanceId: string;
  name?: string;
  description?: string;
  status?: ProcessStatus;
  /** Process-level configuration (e.g., hideBudget) */
  config?: ProcessConfig;
  /** Optional phase overrides (dates and settings) */
  phases?: PhaseOverride[];
  user: User;
}) => {
  // Fetch existing instance
  const existingInstance = await db.query.processInstances.findFirst({
    where: eq(processInstances.id, instanceId),
  });

  if (!existingInstance) {
    throw new NotFoundError('Process instance not found');
  }

  if (!existingInstance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  // Check if user has admin access on the decision instance's profile
  const profileUser = await getProfileAccessUser({
    user,
    profileId: existingInstance.profileId,
  });

  assertAccess({ profile: permission.ADMIN }, profileUser?.roles ?? []);

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

  // Apply config and/or phase overrides to existing instanceData
  const hasConfigUpdate = config !== undefined;
  const hasPhaseUpdates = phases && phases.length > 0;

  if (hasConfigUpdate || hasPhaseUpdates) {
    const existingInstanceData =
      existingInstance.instanceData as DecisionInstanceData;

    let updatedInstanceData: DecisionInstanceData = { ...existingInstanceData };

    // Apply config updates (merge with existing config)
    if (hasConfigUpdate) {
      updatedInstanceData.config = {
        ...existingInstanceData.config,
        ...config,
      };
    }

    // Apply phase overrides
    if (hasPhaseUpdates) {
      // Create a map of phase overrides for quick lookup
      const overrideMap = new Map(
        phases.map((override) => [override.phaseId, override]),
      );

      // Apply overrides to existing phases (merge settings, don't replace)
      updatedInstanceData.phases = existingInstanceData.phases.map((phase) => {
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
          ...(override.settings !== undefined && {
            settings: {
              ...phase.settings,
              ...override.settings,
            },
          }),
        };
      });
    }

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
