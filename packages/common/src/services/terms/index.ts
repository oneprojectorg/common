import { InferSelectModel, SQL, and, db, eq, sql } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';

interface TermLookupHandler {
  query?: string;
  name: string;
}

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

  let whereClause = eq(taxonomies.name, taxonomyName);
  if (facet) {
    whereClause = and(
      whereClause,
      eq(taxonomyTerms.facet, facet.trim()),
    ) as SQL<unknown>;
  }

  if (query) {
    whereClause = sql`${taxonomies.name} = ${taxonomyName} AND ${taxonomyTerms.facet} = ${facet?.trim() ?? null} AND ${taxonomyTerms.label} @@to_tsquery('english', ${query + ':*'})`;
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

export const getTerms = async ({
  name,
  query,
}: {
  name: string;
  query?: string;
}): Promise<Array<InferSelectModel<typeof taxonomyTerms>>> => {
  const [taxonomyName] = name.split(':');
  const handler = nameHandlers[taxonomyName] ?? getTermsFromDb;

  try {
    const terms = await handler({ query, name });

    return terms;
  } catch (e) {
    return [];
  }
};
