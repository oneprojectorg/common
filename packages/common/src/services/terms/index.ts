import { InferSelectModel, SQL, and, db, eq, sql } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';

interface TermLookupHandler {
  query?: string;
  name: string;
}

/*
const getTermsFromCandid = async ({ query, name }: TermLookupHandler) => {
  const [, facet] = name.trim().split(':');
  const gqlQuery = `
  query termsByFacet($facet: FacetType!) {
    termsByFacet(facet: $facet) {
      meta {
    code
    message
    resultsCount
    took
  }
    data {
    code
    name
    description
    facet
    depth
    hasChildren
  }
    }
  }
  `;

  // const gqlQuery = `
  // query {
  // termsByMatch(match: {
  // searchTerm: "${query?.trim() ?? ''}",
  // facet: ${facet},
  // limit: 100}) {
  // meta {
  // code
  // message
  // resultsCount
  // took
  // }
  // data {
  // code
  // name
  // description
  // facet
  // depth
  // hasChildren
  // }
  // }
  // }
  // `;

  if (!process.env.CANDID_API_KEY) {
    return [];
  }

  const response = await fetch('https://api.candid.org/taxonomy/graphql/', {
    method: 'POST',
    headers: new Headers({
      'Content-Type': 'application/json',
      'Subscription-Key': process.env.CANDID_API_KEY,
    }),
    body: JSON.stringify({
      query: gqlQuery,
      variables: { facet },
    }),
  });

  const data = await response.json();

  if (data.errors) {
    console.error('Candid Errors:', data.errors);
    return null;
  }

  type CandidTerm = {
    code: string;
    name: string;
    description: string;
    facet: string;
    depth: number;
    hasChildren: boolean;
  };

  const transformed = data.data.termsByFacet.data.map((term: CandidTerm) => ({
    id: term.code,
    label: term.name,
    taxonomyId: name,
    definition: term.description,
    data: term,
  }));

  return transformed;
};
*/

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
    whereClause = sql`${taxonomies.namespaceUri} = ${taxonomyName} AND ${taxonomyTerms.facet} = ${facet?.trim() ?? null} AND ${taxonomyTerms.label} @@to_tsquery('english', ${query + ':*'})`;
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
