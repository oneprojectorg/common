import { InferSelectModel, db, eq, sql } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';

// const getTermsFromCandid = async ({ query }) => {
// const gqlQuery = `
// query termsByMatch($match: MatchInput) {
// termsByMatch(match: $match) {
// meta {
// ...MetaFragment
// }
// data {
// ...TermFragment
// }
// }
// }
// `;

// const variables = {
// match: {
// searchTerm: query,
// limit: 100,
// },
// };

// const response = await fetch('https://api.candid.org/taxonomy/graphql/', {
// method: 'POST',
// headers: {
// 'Content-Type': 'application/json',
// 'Subscription-Key': 'Bearer YOUR_AUTH_TOKEN', // Include if authentication is required
// },
// body: JSON.stringify({
// query: gqlQuery,
// variables,
// }),
// });

// return await response.json();
// };

export const getTerms = async ({
  name,
  query,
}: {
  name: string;
  query?: string;
}): Promise<Array<InferSelectModel<typeof taxonomyTerms>>> => {
  try {
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
  } catch (e) {
    return [];
  }
};
