import { db, eq } from '@op/db/client';
import {
  decisionProcesses,
  taxonomies,
  taxonomyTerms,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils';
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

export interface CreateProcessInput {
  name: string;
  description?: string;
  processSchema: ProcessSchema;
}

export const createProcess = async ({
  data,
  user,
}: {
  data: CreateProcessInput;
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

    // Extract and trim categories from the process schema
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

    const [process] = await db
      .insert(decisionProcesses)
      .values({
        name: data.name,
        description: data.description,
        processSchema: data.processSchema,
        createdByProfileId: dbUser.currentProfileId,
      })
      .returning();

    if (!process) {
      throw new CommonError('Failed to create decision process');
    }

    return process;
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof CommonError) {
      throw error;
    }
    console.error('Error creating decision process:', error);
    throw new CommonError('Failed to create decision process');
  }
};
