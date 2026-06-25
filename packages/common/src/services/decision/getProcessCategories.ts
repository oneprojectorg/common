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

export interface LoadedDecisionInstanceCategories {
  /** Auth scope from the instance, used by the access check. `null` means the instance is missing. */
  instance: {
    profileId: string | null;
    ownerProfileId: string | null;
  } | null;
  categories: ProcessCategory[];
}

/**
 * Viewer-independent load for `getProcessCategories`: the auth scope + the
 * resolved categories list. Intended to be wrapped in `cache()` at the API
 * layer. Returns `instance: null` when the row doesn't exist so callers can
 * skip the access check and return an empty list.
 */
export const loadDecisionInstanceCategories = async ({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<LoadedDecisionInstanceCategories> => {
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
  preloaded,
}: {
  processInstanceId: string;
  user: User | undefined;
  /**
   * Optional pre-loaded payload, typically returned by
   * `loadDecisionInstanceCategories` and cached at the API layer. Omit to
   * fetch fresh from the DB.
   */
  preloaded?: LoadedDecisionInstanceCategories;
}): Promise<ProcessCategory[]> => {
  try {
    const loaded =
      preloaded ??
      (await loadDecisionInstanceCategories({ processInstanceId }));

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
