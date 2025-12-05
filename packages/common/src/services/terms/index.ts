import { InferSelectModel, SQL, and, db, eq, isNull, sql } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';

interface TermLookupHandler {
  query?: string;
  name: string;
}

const getTermsFromDb = async ({
  query,
  name,
}: {
  query?: string;
  name: string;
}) => {
  const [taxonomyName, facet] = name.split(':');

  if (!taxonomyName) {
    return [];
  }

  let whereClause = eq(taxonomies.namespaceUri, taxonomyName);
  if (facet) {
    whereClause = and(
      whereClause,
      eq(taxonomyTerms.facet, facet.trim()),
    ) as SQL<unknown>;
  }

  if (query) {
    const taxonomyCondition = eq(taxonomies.namespaceUri, taxonomyName);
    const facetCondition = facet
      ? eq(taxonomyTerms.facet, facet.trim())
      : isNull(taxonomyTerms.facet);
    const searchCondition = sql`to_tsvector('english', ${taxonomyTerms.label}) @@to_tsquery('english', ${query.trim().replaceAll(' ', '\\ ') + ':*'})`;

    whereClause = and(
      taxonomyCondition,
      facetCondition,
      searchCondition,
    ) as SQL<unknown>;
  }

  const results = await db
    .select()
    .from(taxonomyTerms)
    .innerJoin(taxonomies, () => eq(taxonomyTerms.taxonomyId, taxonomies.id))
    .where(whereClause);

  const terms = results.map((row) => row.taxonomyTerms);

  return terms;
};

const nameHandlers: Record<
  string,
  (
    args: TermLookupHandler,
  ) => Promise<Array<InferSelectModel<typeof taxonomyTerms>>>
> = {
  // candid: getTermsFromCandid,
};

type TaxonomyTerms = InferSelectModel<typeof taxonomyTerms>;
export type TermWithChildren = TaxonomyTerms & {
  children: TermWithChildren[];
};

// Build a tree of terms with parents and children[]
const buildTermTree = (terms: TaxonomyTerms[]): TermWithChildren[] => {
  const termMap = new Map<string, TermWithChildren>();
  const rootTerms: TermWithChildren[] = [];

  // create map of all terms with empty children arrays
  terms.forEach((term) => {
    termMap.set(term.id, { ...term, children: [] });
  });

  // build the tree structure
  terms.forEach((term) => {
    const termWithChildren = termMap.get(term.id)!;

    if (term.parentId) {
      const parent = termMap.get(term.parentId);
      if (parent) {
        parent.children.push(termWithChildren);
      } else {
        // Parent not found in current result set, treat as root
        rootTerms.push(termWithChildren);
      }
    } else {
      // No parent, this is a root term
      rootTerms.push(termWithChildren);
    }
  });

  return rootTerms;
};

export const getTerms = async ({
  name,
  query,
}: {
  name: string;
  query?: string;
}): Promise<TermWithChildren[]> => {
  const [taxonomyName] = name.split(':');
  const handler = nameHandlers[taxonomyName ?? name] ?? getTermsFromDb;

  try {
    const terms = await handler({ query, name });

    return buildTermTree(terms);
  } catch (e) {
    return [];
  }
};
