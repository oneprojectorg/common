import { InferSelectModel, db, eq, sql } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';

interface TermLookupHandler {
  query?: string;
  name: string;
}

const getTermsFromCandid = async ({ query }: TermLookupHandler) => {
  const gqlQuery = `
query termsByMatch($match: MatchInput) {
termsByMatch(match: $match) {
meta {
...MetaFragment
}
data {
...TermFragment
}
}
}
`;

  const variables = {
    match: {
      searchTerm: query,
      limit: 100,
    },
  };

  const response = await fetch('https://api.candid.org/taxonomy/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Subscription-Key': 'Bearer YOUR_AUTH_TOKEN', // Include if authentication is required
    },
    body: JSON.stringify({
      query: gqlQuery,
      variables,
    }),
  });

  return await response.json();
};

const getTermsFromDb = async ({
  query,
  name,
}: {
  query?: string;
  name: string;
}) => {
  let whereClause = eq(taxonomies.name, name);
  if (query) {
    whereClause = sql`${taxonomies.name} = ${name} AND ${taxonomyTerms.label} @@ plainto_tsquery('english', ${query})`;
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
  candid: getTermsFromCandid,
};

export const getTerms = async ({
  name,
  query,
}: {
  name: string;
  query?: string;
}): Promise<Array<InferSelectModel<typeof taxonomyTerms>>> => {
  const handler = nameHandlers[name] ?? getTermsFromDb;

  try {
    const terms = await handler({ query, name });

    return terms;
  } catch (e) {
    return [];
  }
};
