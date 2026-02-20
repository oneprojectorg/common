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
import { buildCategorySchema } from './proposalDataSchema';
import type {
  DecisionInstanceData,
  PhaseOverride,
} from './schemas/instanceData';
import type { ProcessConfig } from './schemas/types';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

/**
 * Synchronizes the proposalTemplate's category field, field order, and
 * required array with the current process config (categories list and
 * requireCategorySelection flag).  This ensures the template stays
 * consistent even when only config is updated.
 */
function syncProposalTemplateWithConfig(
  instanceData: DecisionInstanceData,
): DecisionInstanceData {
  const template = instanceData.proposalTemplate;
  if (!template) {
    return instanceData;
  }

  const config = instanceData.config;
  const categories = config?.categories ?? [];
  const properties = (template.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  let updatedProperties = { ...properties };

  // Sync category field options
  if (categories.length > 0) {
    const categoryLabels = categories.map((c) => c.label);
    const existing = properties.category;
    updatedProperties.category = buildCategorySchema(categoryLabels, existing);
    // Preserve existing title
    if (existing?.title) {
      updatedProperties.category.title = existing.title;
    }
  } else if (properties.category) {
    const { category: _, ...rest } = updatedProperties;
    updatedProperties = rest;
  }

  // Sync x-field-order
  const order = ((template as Record<string, unknown>)['x-field-order'] ??
    []) as string[];
  const hasCategory = 'category' in updatedProperties;
  let updatedOrder: string[];
  if (hasCategory && !order.includes('category')) {
    const titleIdx = order.indexOf('title');
    updatedOrder = [...order];
    updatedOrder.splice(titleIdx + 1, 0, 'category');
  } else if (!hasCategory) {
    updatedOrder = order.filter((k) => k !== 'category');
  } else {
    updatedOrder = order;
  }

  // Sync required array
  const required = new Set((template.required ?? []) as string[]);
  if (updatedProperties.category && config?.requireCategorySelection) {
    required.add('category');
  } else {
    required.delete('category');
  }

  return {
    ...instanceData,
    proposalTemplate: {
      ...template,
      properties: updatedProperties,
      'x-field-order': updatedOrder,
      required: [...required],
    } as DecisionInstanceData['proposalTemplate'],
  };
}

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

    // Sync proposalTemplate with the (possibly updated) config so that
    // category field options, field order, and required stay consistent.
    updatedInstanceData = syncProposalTemplateWithConfig(updatedInstanceData);

    // Apply phase updates — replaces the full phases array to accommodate
    // adding, removing, and reordering phases from the phase editor.
    // Existing phase data (selectionPipeline, settingsSchema, etc.) is
    // preserved by merging with the previous phase when a match exists.
    if (hasPhaseUpdates) {
      const existingPhaseMap = new Map(
        existingInstanceData.phases.map((p) => [p.phaseId, p]),
      );

      updatedInstanceData.phases = phases.map((phase) => {
        const existing = existingPhaseMap.get(phase.phaseId);
        return {
          ...existing,
          phaseId: phase.phaseId,
          ...(phase.name !== undefined && { name: phase.name }),
          ...(phase.description !== undefined && {
            description: phase.description,
          }),
          ...(phase.headline !== undefined && { headline: phase.headline }),
          ...(phase.additionalInfo !== undefined && {
            additionalInfo: phase.additionalInfo,
          }),
          ...(phase.rules !== undefined && { rules: phase.rules }),
          ...(phase.startDate !== undefined && { startDate: phase.startDate }),
          ...(phase.endDate !== undefined && { endDate: phase.endDate }),
          ...(phase.settings !== undefined && { settings: phase.settings }),
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

    // Keep the profile name in sync with the instance name
    if (name !== undefined) {
      await tx.update(profiles).set({ name }).where(eq(profiles.id, profileId));
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
