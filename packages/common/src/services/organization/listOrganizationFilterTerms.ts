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

interface UsedTermsQuery extends TaxonomyScope {
  usedIn: typeof organizationsTerms | typeof organizationsStrategies;
}

/** Focus-area and strategy terms at least one organization is tagged with. */
export const listOrganizationFilterTerms = async ({
  focusAreaTaxonomy = { namespaceUri: 'necSimple', facet: 'focusArea' },
  strategyTaxonomy = { namespaceUri: 'splcStrategies' },
}: {
  focusAreaTaxonomy?: TaxonomyScope;
  strategyTaxonomy?: TaxonomyScope;
} = {}) => {
  const [focusAreas, strategies] = await Promise.all([
    listUsedTerms({ ...focusAreaTaxonomy, usedIn: organizationsTerms }),
    listUsedTerms({ ...strategyTaxonomy, usedIn: organizationsStrategies }),
  ]);

  return { focusAreas, strategies };
};

const listUsedTerms = async ({
  namespaceUri,
  facet,
  usedIn,
}: UsedTermsQuery): Promise<{ id: string; label: string; slug: string }[]> => {
  const terms = await db
    .select({
      id: taxonomyTerms.id,
      label: taxonomyTerms.label,
      termUri: taxonomyTerms.termUri,
    })
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

  return terms.map(({ id, label, termUri }) => ({
    id,
    label,
    slug: getTermSlug(termUri),
  }));
};

/** `necSimple:energyAndUtilities` → `energy-and-utilities` */
const getTermSlug = (termUri: string) =>
  (termUri.split(':').at(-1) ?? termUri)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
