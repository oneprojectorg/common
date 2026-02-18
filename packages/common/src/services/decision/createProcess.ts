import { db } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import type { ProcessSchema } from './types';
import { ensureProposalTaxonomy } from './utils/ensureProposalTaxonomy';

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
  try {
    const dbUser = await assertUserByAuthId(user.id);

    if (!dbUser.currentProfileId) {
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
