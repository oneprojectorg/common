import { db, eq } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import type { ProcessSchema } from './types';
import { ensureProposalTaxonomy } from './utils/ensureProposalTaxonomy';

export interface UpdateProcessInput {
  name?: string;
  description?: string;
  processSchema?: ProcessSchema;
}

export const updateProcess = async ({
  processId,
  data,
  user,
}: {
  processId: string;
  data: UpdateProcessInput;
  user: User;
}) => {
  try {
    const dbUser = await assertUserByAuthId(user.id);

    if (!dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Check if process exists and user has permission to update it
    const existingProcess = await db._query.decisionProcesses.findFirst({
      where: eq(decisionProcesses.id, processId),
    });

    if (!existingProcess) {
      throw new NotFoundError('Decision process not found');
    }

    // Only allow editing from the context of the process owner (usually an org)
    if (existingProcess.createdByProfileId !== dbUser.currentProfileId) {
      throw new UnauthorizedError('Not authorized to update this process');
    }

    // If processSchema is being updated, ensure taxonomy terms exist for any new categories
    // and update proposal template enums
    if (data.processSchema) {
      const categories = (
        ((data.processSchema?.fields as any)?.categories as string[]) || []
      )
        .map((category) => category.trim())
        .filter((category) => category.length > 0);

      // Update the input data with trimmed categories
      if (data.processSchema?.fields) {
        (data.processSchema.fields as any).categories = categories;
      }

      // Ensure proposal taxonomy and terms exist for the categories
      await ensureProposalTaxonomy(categories);

      // Update the proposal template to include the new category enums
      if (data.processSchema.proposalTemplate) {
        const currentProposalTemplate = data.processSchema
          .proposalTemplate as any;
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

        data.processSchema.proposalTemplate = updatedProposalTemplate;
      }
    }

    const [updatedProcess] = await db
      .update(decisionProcesses)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(decisionProcesses.id, processId))
      .returning();

    if (!updatedProcess) {
      throw new CommonError('Failed to update decision process');
    }

    return updatedProcess;
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof NotFoundError) {
      throw error;
    }
    console.error('Error updating decision process:', error);
    throw new CommonError('Failed to update decision process');
  }
};
