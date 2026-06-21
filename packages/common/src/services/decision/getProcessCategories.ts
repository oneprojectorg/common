import { cache } from '@op/cache';
import { db } from '@op/db/client';
import { ClaimsUser } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import type { DecisionInstanceData } from './schemas';

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
  user: ClaimsUser | undefined;
}): Promise<ProcessCategory[]> => {
  try {
    // The DB load is viewer-independent, so cache it under `[id, 'categories']`.
    // The access check stays outside the cache, so a hit can never bypass
    // authorization.
    const instance = await cache({
      type: 'decision',
      params: [processInstanceId, 'categories'],
      fetch: () =>
        db.query.processInstances.findFirst({
          where: { id: processInstanceId },
          with: {
            process: true,
          },
        }),
    });

    if (!instance || !instance.process) {
      return [];
    }

    // Run access check and taxonomy lookup in parallel — they're independent
    const [proposalTaxonomy] = await Promise.all([
      db.query.taxonomies.findFirst({
        where: { name: 'proposal' },
        with: {
          taxonomyTerms: true,
        },
      }),
      assertInstanceProfileAccess({
        user,
        instance: {
          profileId: instance.profileId,
          ownerProfileId: instance.ownerProfileId,
        },
        profilePermissions: { decisions: permission.READ },
        orgFallbackPermissions: { decisions: permission.READ },
      }),
    ]);

    // Extract categories from the instance config
    const instanceCategories = (instance.instanceData as DecisionInstanceData)
      .config?.categories;

    if (!instanceCategories || instanceCategories.length === 0) {
      return [];
    }

    if (!proposalTaxonomy) {
      return [];
    }

    // Find matching taxonomy terms for the categories
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

    return categories;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error getting process categories:', error);
    return [];
  }
};
