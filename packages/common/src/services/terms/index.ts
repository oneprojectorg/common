import { InferSelectModel, db, eq, sql } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';

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
