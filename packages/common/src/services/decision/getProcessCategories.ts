import { db, eq } from '@op/db/client';
import { organizations, processInstances, taxonomies } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

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
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get the process instance with its process schema
    const instance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, processInstanceId),
      with: {
        process: true,
      },
    });

    if (!instance || !instance.process) {
      return [];
    }

    const instanceOrg = await db
      .select({
        id: organizations.id,
      })
      .from(organizations)
      .where(eq(organizations.profileId, instance.ownerProfileId))
      .limit(1);

    if (!instanceOrg[0]) {
      throw new NotFoundError('Organization not found');
    }

    // ASSERT VIEW ACCESS ON ORGUSER
    const orgUser = await getOrgAccessUser({
      user,
      organizationId: instanceOrg[0].id,
    });

    assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

    // Extract categories from the process schema and instance data
    const process = Array.isArray(instance.process)
      ? instance.process[0]
      : instance.process;
    const processSchema = process?.processSchema as any;
    const processSchemaCategories = (processSchema?.fields?.categories as string[]) || [];

    // Check instance data for categories (updated categories are stored here)
    const instanceData = instance.instanceData as any;
    const instanceCategories = (instanceData?.fieldValues?.categories as string[]) || [];

    // If instance has categories field defined (even if empty), use those (they represent the current state including removals)
    // Otherwise, fall back to the original process schema categories
    const categoryNames = instanceData?.fieldValues && 'categories' in instanceData.fieldValues
      ? instanceCategories.filter(cat => cat && cat.trim())
      : processSchemaCategories.filter(cat => cat && cat.trim());

    if (categoryNames.length === 0) {
      return [];
    }

    // Get the "proposal" taxonomy
    const proposalTaxonomy = await db.query.taxonomies.findFirst({
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
