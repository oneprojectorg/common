import { db, eq } from '@op/db/client';
import { processInstances, taxonomies } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';

export interface ProcessCategory {
  id: string;
  name: string;
  termUri: string;
}

export const getProcessCategories = async ({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  authUserId: string;
  user: User;
}): Promise<ProcessCategory[]> => {
  try {
    // Get the process instance with its process schema
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, processInstanceId),
      with: {
        process: true,
      },
    });

    if (!instance || !instance.process) {
      return [];
    }

    await assertInstanceProfileAccess({
      user,
      instance: {
        profileId: instance.profileId,
        ownerProfileId: instance.ownerProfileId,
      },
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: { decisions: permission.READ },
    });

    // Extract categories from the process schema
    const process = Array.isArray(instance.process)
      ? instance.process[0]
      : instance.process;
    const processSchema = process?.processSchema as any;
    const categoryNames = (processSchema?.fields?.categories as string[]) || [];

    if (categoryNames.length === 0) {
      return [];
    }

    // Get the "proposal" taxonomy
    const proposalTaxonomy = await db._query.taxonomies.findFirst({
      where: eq(taxonomies.name, 'proposal'),
      with: {
        taxonomyTerms: true,
      },
    });

    if (!proposalTaxonomy) {
      return [];
    }

    // Find matching taxonomy terms for the categories
    const categories: ProcessCategory[] = [];

    for (const categoryName of categoryNames) {
      const categoryLabel = categoryName.trim();
      const expectedTermUri = categoryLabel
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const taxonomyTerm = proposalTaxonomy.taxonomyTerms.find(
        (term) => term.termUri === expectedTermUri,
      );

      if (taxonomyTerm) {
        categories.push({
          id: taxonomyTerm.id,
          name: taxonomyTerm.label,
          termUri: taxonomyTerm.termUri,
        });
      }
    }

    return categories;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error getting process categories:', error);
    return [];
  }
};
