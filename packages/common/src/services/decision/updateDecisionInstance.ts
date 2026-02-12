import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
  profiles,
} from '@op/db/schema';
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
  stewardProfileId,
  config,
  phases,
  proposalTemplate,
  user,
}: {
  instanceId: string;
  name?: string;
  description?: string;
  status?: ProcessStatus;
  stewardProfileId?: string;
  /** Process-level configuration (e.g., hideBudget) */
  config?: ProcessConfig;
  /** Optional phase overrides (dates and settings) */
  phases?: PhaseOverride[];
  /** Proposal template (JSON Schema + embedded UI Schema) */
  proposalTemplate?: Record<string, unknown>;
  user: User;
}) => {
  // Fetch existing instance
  const existingInstance = await db._query.processInstances.findFirst({
    where: eq(processInstances.id, instanceId),
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

  // Check if user has admin access on the decision instance's profile
  const profileUser = await getProfileAccessUser({
    user,
    profileId,
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

  if (stewardProfileId !== undefined) {
    updateData.stewardProfileId = stewardProfileId;
  }

  // Apply config, phase overrides, and/or proposalTemplate to existing instanceData
  const hasConfigUpdate = config !== undefined;
  const hasPhaseUpdates = phases && phases.length > 0;
  const hasProposalTemplateUpdate = proposalTemplate !== undefined;

  if (hasConfigUpdate || hasPhaseUpdates || hasProposalTemplateUpdate) {
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

    // Apply proposal template update (replace entirely)
    if (hasProposalTemplateUpdate) {
      updatedInstanceData = {
        ...updatedInstanceData,
        proposalTemplate,
      } as DecisionInstanceData;
    }

    updateData.instanceData = updatedInstanceData;
  }

  // Only update if there's something to update
  if (Object.keys(updateData).length === 0) {
    // Nothing to update, just return the existing profile
    const profile = await db._query.profiles.findFirst({
      where: eq(profiles.id, profileId),
      with: {
        processInstance: true,
      },
    });

    if (!profile) {
      throw new CommonError('Failed to fetch decision profile');
    }

    return profile;
  }

  // Use a transaction for updating the instance and transitions together
  await db.transaction(async (tx) => {
    // Update the instance
    const [updatedInstance] = await tx
      .update(processInstances)
      .set(updateData)
      .where(eq(processInstances.id, instanceId))
      .returning();

    if (!updatedInstance) {
      throw new CommonError('Failed to update decision process instance');
    }

    // Determine the final status (updated or existing)
    const finalStatus = status ?? existingInstance.status;

    // If status is DRAFT, remove all transitions
    if (finalStatus === ProcessStatus.DRAFT) {
      await tx
        .delete(decisionProcessTransitions)
        .where(eq(decisionProcessTransitions.processInstanceId, instanceId));
    } else if (phases && phases.length > 0) {
      // If phases were updated and not DRAFT, update the corresponding transitions
      await updateTransitionsForProcess({
        processInstance: updatedInstance,
        tx,
      });
    }
  });

  // Fetch the profile with processInstance joined for the response
  const profile = await db._query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    with: {
      processInstance: true,
    },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch updated decision profile');
  }

  return profile;
};
