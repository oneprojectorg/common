import { cache } from '@op/cache';
import { and, db, eq, isNotNull } from '@op/db/client';
import { decisionBoundaries } from '@op/db/schema';
import { logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { categoryTermUri } from './proposalTaxonomy';
import type { DecisionInstanceData } from './schemas';

export interface ProcessCategory {
  id: string;
  name: string;
  termUri: string;
  /** Linked to one of the decision's boundaries, i.e. a district. */
  isDistrict: boolean;
}

export const getProcessCategories = async ({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User | undefined;
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
        }),
    });

    if (!instance) {
      return [];
    }

    // Run access check and taxonomy lookup in parallel — they're independent
    const [proposalTaxonomy, , districtTermIds] = await Promise.all([
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
      getDistrictTermIds(instance.profileId),
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
      // Same slug helper term creation uses, so accented/unicode labels resolve
      // (see categoryTermUri). A hand-rolled regex here would strip accents the
      // strict slugify folds, silently dropping the category.
      const expectedTermUri = categoryTermUri(category.label);

      const taxonomyTerm = proposalTaxonomy.taxonomyTerms.find(
        (term: { termUri: string }) => term.termUri === expectedTermUri,
      );

      if (taxonomyTerm) {
        categories.push({
          id: taxonomyTerm.id,
          name: taxonomyTerm.label,
          termUri: taxonomyTerm.termUri,
          isDistrict: districtTermIds.has(taxonomyTerm.id),
        });
      }
    }

    return categories;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    logger.error('Error getting process categories', { error });
    return [];
  }
};

/** Terms the decision's boundaries are linked to; each is a district. */
async function getDistrictTermIds(
  profileId: string | null,
): Promise<Set<string>> {
  if (!profileId) {
    return new Set();
  }

  const rows = await db
    .select({ taxonomyTermId: decisionBoundaries.taxonomyTermId })
    .from(decisionBoundaries)
    .where(
      and(
        eq(decisionBoundaries.profileId, profileId),
        isNotNull(decisionBoundaries.taxonomyTermId),
      ),
    );

  return new Set(rows.flatMap((row) => row.taxonomyTermId ?? []));
}
