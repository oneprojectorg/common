import { db, eq } from '@op/db/client';
import {
  decisionProcesses,
  taxonomies,
  taxonomyTerms,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import type { ProcessSchema } from './types';

/**
 * Ensures the "proposal" taxonomy exists and creates/updates taxonomy terms for the given categories
 */
async function ensureProposalTaxonomy(categories: string[]): Promise<string[]> {
  if (!categories || categories.length === 0) {
    return [];
  }

  // Ensure "proposal" taxonomy exists
  let proposalTaxonomy = await db.query.taxonomies.findFirst({
    where: eq(taxonomies.name, 'proposal'),
  });

  if (!proposalTaxonomy) {
    const [newTaxonomy] = await db
      .insert(taxonomies)
      .values({
        name: 'proposal',
        description:
          'Categories for organizing proposals in decision-making processes',
      })
      .returning();

    if (!newTaxonomy) {
      throw new CommonError('Failed to create proposal taxonomy');
    }
    proposalTaxonomy = newTaxonomy;
  }

  // Process each category
  const taxonomyTermIds: string[] = [];

  for (const categoryName of categories) {
    if (!categoryName.trim()) continue;

    const categoryLabel = categoryName.trim();
    const termUri = categoryLabel
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Check if taxonomy term already exists
    let existingTerm = await db.query.taxonomyTerms.findFirst({
      where: eq(taxonomyTerms.termUri, termUri),
    });

    if (!existingTerm) {
      // Create new taxonomy term
      const [newTerm] = await db
        .insert(taxonomyTerms)
        .values({
          taxonomyId: proposalTaxonomy.id,
          termUri,
          label: categoryLabel,
          definition: `Category for ${categoryLabel} proposals`,
        })
        .returning();

      if (!newTerm) {
        throw new CommonError(
          `Failed to create taxonomy term for category: ${categoryLabel}`,
        );
      }
      existingTerm = newTerm;
    }

    if (existingTerm) {
      taxonomyTermIds.push(existingTerm.id);
    }
  }

  return taxonomyTermIds;
}

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
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get the database user record to access currentProfileId
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authUserId, user.id),
    });

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Check if process exists and user has permission to update it
    const existingProcess = await db.query.decisionProcesses.findFirst({
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
      const categories =
        ((data.processSchema?.fields as any)?.categories as string[]) || [];

      // Ensure proposal taxonomy and terms exist for the categories
      await ensureProposalTaxonomy(categories);

      // Update the proposal template to include the new category enums
      if (data.processSchema.proposalTemplate) {
        const currentProposalTemplate = data.processSchema.proposalTemplate as any;
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
        if (categories.length === 0 && updatedProposalTemplate.properties.category) {
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
