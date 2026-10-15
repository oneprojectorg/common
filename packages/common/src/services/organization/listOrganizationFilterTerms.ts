import { and, asc, db, eq, exists } from '@op/db/client';
import {
  organizationsStrategies,
  organizationsTerms,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';

interface TaxonomyScope {
  namespaceUri: string;
  facet?: string;
}

/**
 * The focus-area and strategy terms that at least one organization is tagged
 * with, ordered by label — the options for the organizations directory
 * filters. `organizations_terms` also holds other taxonomies (communities
 * served, funding), so each list is scoped to its taxonomy.
 */
export const listOrganizationFilterTerms = async ({
  focusAreaTaxonomy = { namespaceUri: 'necSimple', facet: 'focusArea' },
  strategyTaxonomy = { namespaceUri: 'splcStrategies' },
}: {
  focusAreaTaxonomy?: TaxonomyScope;
  strategyTaxonomy?: TaxonomyScope;
} = {}) => {
  const [focusAreas, strategies] = await Promise.all([
    listUsedTerms(focusAreaTaxonomy, organizationsTerms),
    listUsedTerms(strategyTaxonomy, organizationsStrategies),
  ]);

  return { focusAreas, strategies };
};

const listUsedTerms = (
  { namespaceUri, facet }: TaxonomyScope,
  usedIn: typeof organizationsTerms | typeof organizationsStrategies,
) =>
  db
    .select({ id: taxonomyTerms.id, label: taxonomyTerms.label })
    .from(taxonomyTerms)
    .innerJoin(taxonomies, eq(taxonomyTerms.taxonomyId, taxonomies.id))
    .where(
      and(
        eq(taxonomies.namespaceUri, namespaceUri),
        facet ? eq(taxonomyTerms.facet, facet) : undefined,
        exists(
          db
            .select()
            .from(usedIn)
            .where(eq(usedIn.taxonomyTermId, taxonomyTerms.id)),
        ),
      ),
    )
    .orderBy(asc(taxonomyTerms.label), asc(taxonomyTerms.id));
