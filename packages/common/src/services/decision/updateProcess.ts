import { db, eq } from '@op/db/client';
import { decisionProcesses, taxonomies, taxonomyTerms } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import type { ProcessSchema } from './types';

/**
 * Ensures the "proposal" taxonomy exists and creates/updates taxonomy terms for the given categories
 */
async function ensureProposalTaxonomy(categories: string[]): Promise<string[]> {
  if (!categories || categories.length === 0) {
    return [];
  }

  // Ensure "proposal" taxonomy exists
  let proposalTaxonomy = await db._query.taxonomies.findFirst({
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
    let existingTerm = await db._query.taxonomyTerms.findFirst({
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

      // Update the proposal template category field using oneOf format
      if (data.processSchema.proposalTemplate) {
        const currentProposalTemplate = data.processSchema
          .proposalTemplate as any;
        const existingCategory =
          currentProposalTemplate.properties?.category ?? {};
        const { enum: _legacyEnum, ...categoryRest } = existingCategory;
        const updatedProposalTemplate = {
          ...currentProposalTemplate,
          properties: {
            ...currentProposalTemplate.properties,
            ...(categories.length > 0
              ? {
                  category: {
                    ...categoryRest,
                    type: ['string', 'null'],
                    'x-format': 'category',
                    oneOf: categories.map((c) => ({ const: c, title: c })),
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
