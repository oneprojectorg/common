import { db, eq } from '@op/db/client';
import {
  processInstances,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { z } from 'zod';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';
import type { InstanceData } from './types';

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

export interface UpdateInstanceInput {
  instanceId: string;
  authUserId: string;
  name?: string;
  description?: string;
  instanceData?: InstanceData;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
}

// Zod schema for the update data (excluding instanceId)
const updateDataSchema = z
  .object({
    name: z.string().min(3).max(256).optional(),
    description: z.string().optional(),
    instanceData: z.any().optional(), // Using any for now since InstanceData is a complex type
    status: z
      .enum(['draft', 'active', 'paused', 'completed', 'cancelled'])
      .optional(),
  })
  .strip() // Remove any extra fields
  .transform((data) => {
    // Remove undefined fields for cleaner database updates
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    );
  });

export const updateInstance = async ({
  data,
  user,
}: {
  data: UpdateInstanceInput;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    const currentProfileId = await getCurrentProfileId(data.authUserId);

    if (!currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Verify the instance exists and user has permission
    const existingInstance = await db.query.processInstances.findFirst({
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
    if (data.instanceData && data.instanceData.fieldValues?.categories) {
      const categories = Array.isArray(data.instanceData.fieldValues.categories)
        ? data.instanceData.fieldValues.categories.filter(
            (cat: unknown): cat is string => typeof cat === 'string' && cat.trim() !== ''
          )
        : [];

      // Ensure proposal taxonomy and terms exist for the categories
      await ensureProposalTaxonomy(categories);
    }

    const [updatedInstance] = await db
      .update(processInstances)
      .set(updateData)
      .where(eq(processInstances.id, data.instanceId))
      .returning();

    if (!updatedInstance) {
      throw new CommonError('Failed to update decision process instance');
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
