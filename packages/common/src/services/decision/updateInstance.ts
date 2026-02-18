import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcesses,
  processInstances,
} from '@op/db/schema';
import { z } from 'zod';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';
import type { InstanceData } from './types';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';
import { ensureProposalTaxonomy } from './utils/ensureProposalTaxonomy';

export interface UpdateInstanceInput {
  instanceId: string;
  authUserId: string;
  name?: string;
  description?: string;
  instanceData?: InstanceData;
  status?: ProcessStatus;
}

// Zod schema for the update data (excluding instanceId)
const updateDataSchema = z
  .object({
    name: z.string().min(3).max(256).optional(),
    description: z.string().optional(),
    instanceData: z.any().optional(), // Using any for now since InstanceData is a complex type
    status: z.enum(ProcessStatus).optional(),
  }) // Remove any extra fields
  .transform((data) => {
    // Remove undefined fields for cleaner database updates
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    );
  });

export const updateInstance = async (data: UpdateInstanceInput) => {
  try {
    const currentProfileId = await getCurrentProfileId(data.authUserId);

    if (!currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Verify the instance exists and user has permission
    const existingInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, data.instanceId),
    });

    if (!existingInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // TODO: Only owners can edit at the moment. You an broaden this to admins with assertAccess
    if (existingInstance.ownerProfileId !== currentProfileId) {
      throw new UnauthorizedError(
        'You do not have permission to update this process instance',
      );
    }

    const updateData = updateDataSchema.parse(data);

    // If instance data is being updated and contains categories, ensure taxonomy terms exist
    // and update the process schema to keep them in sync
    if (data.instanceData && data.instanceData.fieldValues?.categories) {
      const categories = Array.isArray(data.instanceData.fieldValues.categories)
        ? data.instanceData.fieldValues.categories
            .filter(
              (cat: unknown): cat is string =>
                typeof cat === 'string' && cat.trim() !== '',
            )
            .map((cat: string) => cat.trim())
        : [];

      // Update the input data with trimmed categories
      if (data.instanceData.fieldValues) {
        data.instanceData.fieldValues.categories = categories;
      }

      // Ensure proposal taxonomy and terms exist for the categories
      await ensureProposalTaxonomy(categories);

      // Also update the process schema to keep categories in sync
      if (existingInstance.processId) {
        const existingProcess = await db._query.decisionProcesses.findFirst({
          where: eq(decisionProcesses.id, existingInstance.processId),
        });

        if (existingProcess) {
          const currentProcessSchema = existingProcess.processSchema as any;

          // Update the proposal template to include the new category enums
          const currentProposalTemplate =
            currentProcessSchema?.proposalTemplate || {};
          const updatedProposalTemplate = {
            ...currentProposalTemplate,
            properties: {
              ...currentProposalTemplate.properties,
              ...(categories.length > 0
                ? {
                    category: {
                      type: ['string', 'null'],
                      enum: [...categories, null],
                    },
                  }
                : {}),
            },
          };

          // If no categories, remove the category field from the proposal template
          if (
            categories.length === 0 &&
            updatedProposalTemplate.properties.category
          ) {
            delete updatedProposalTemplate.properties.category;
          }

          const updatedProcessSchema = {
            ...currentProcessSchema,
            fields: {
              ...currentProcessSchema?.fields,
              categories: categories,
            },
            proposalTemplate: updatedProposalTemplate,
          };

          await db
            .update(decisionProcesses)
            .set({
              processSchema: updatedProcessSchema,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(decisionProcesses.id, existingInstance.processId));
        }
      }
    }

    const [updatedInstance] = await db
      .update(processInstances)
      .set(updateData)
      .where(eq(processInstances.id, data.instanceId))
      .returning();

    if (!updatedInstance) {
      throw new CommonError('Failed to update decision process instance');
    }

    // If instanceData.phases were updated, update the corresponding transitions
    if (data.instanceData?.phases) {
      try {
        await updateTransitionsForProcess({ processInstance: updatedInstance });
      } catch (error) {
        console.error(
          'Error updating transitions for process instance:',
          error,
        );
        // Log the error but don't fail the entire update
        // The instance was updated successfully, just the transitions sync failed
      }
    }

    return updatedInstance;
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error updating process instance:', error);
    throw new CommonError('Failed to update process instance');
  }
};
