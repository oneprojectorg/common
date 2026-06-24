import { cache } from '@op/cache';
import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import type { DecisionInstanceData } from './schemas';

export interface ProcessCategory {
  id: string;
  name: string;
  termUri: string;
}

const loadProcessCategoriesFromDb = async (
  processInstanceId: string,
): Promise<{
  instance: {
    profileId: string | null;
    ownerProfileId: string | null;
  } | null;
  categories: ProcessCategory[];
}> => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    with: {
      process: true,
    },
  });

  if (!instance || !instance.process) {
    return { instance: null, categories: [] };
  }

  const instanceForAccess = {
    profileId: instance.profileId,
    ownerProfileId: instance.ownerProfileId,
  };

  const instanceCategories = (instance.instanceData as DecisionInstanceData)
    .config?.categories;

  if (!instanceCategories || instanceCategories.length === 0) {
    return { instance: instanceForAccess, categories: [] };
  }

  const proposalTaxonomy = await db.query.taxonomies.findFirst({
    where: { name: 'proposal' },
    with: {
      taxonomyTerms: true,
    },
  });

  if (!proposalTaxonomy) {
    return { instance: instanceForAccess, categories: [] };
  }

  const categories: ProcessCategory[] = [];

  for (const category of instanceCategories) {
    const expectedTermUri = category.label
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const taxonomyTerm = proposalTaxonomy.taxonomyTerms.find(
      (term: { termUri: string }) => term.termUri === expectedTermUri,
    );

    if (taxonomyTerm) {
      categories.push({
        id: taxonomyTerm.id,
        name: taxonomyTerm.label,
        termUri: taxonomyTerm.termUri,
      });
    }
  }

  return { instance: instanceForAccess, categories };
};

export const getProcessCategories = async ({
  processInstanceId,
  user,
  skipCache = false,
}: {
  processInstanceId: string;
  user: User | undefined;
  /** See `GetInstanceInput.skipCache` — edit flows bypass the categories cache. */
  skipCache?: boolean;
}): Promise<ProcessCategory[]> => {
  try {
    // Categories are derived from the instance config and the global proposal
    // taxonomy — both are viewer-independent, so cache them together. The READ
    // gate stays outside the cache so a hit never bypasses authorization.
    const loaded = skipCache
      ? await loadProcessCategoriesFromDb(processInstanceId)
      : await cache({
          type: 'decision',
          params: [processInstanceId, 'categories'],
          fetch: () => loadProcessCategoriesFromDb(processInstanceId),
        });

    if (!loaded.instance) {
      return [];
    }

    await assertInstanceProfileAccess({
      user,
      instance: loaded.instance,
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: { decisions: permission.READ },
    });

    return loaded.categories;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error getting process categories:', error);
    return [];
  }
};
