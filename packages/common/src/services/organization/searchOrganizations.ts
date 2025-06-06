import { aliasedTable, db, eq, getTableColumns, sql } from '@op/db/client';
import { objectsInStorage, organizations } from '@op/db/schema';
import { User } from '@op/supabase/lib';

export const searchOrganizations = async ({
  user,
  query = '',
  limit = 10,
}: {
  user: User;
  query?: string;
  limit?: number;
}) => {
  if (!user) {
    return [];
  }
  // TODO: assert authorization

  if (query.length < 2) {
    return [];
  }

  const searchQueries = db.$with('search_queries').as(
    db
      .select({
        englishQuery:
          // concatenating to support prefix matches
          sql`to_tsquery('english', (websearch_to_tsquery('english', ${query})::text || ':*'))`.as(
            'english_query',
          ),
        simpleQuery:
          // concatenating to support prefix matches
          sql`to_tsquery('simple', (websearch_to_tsquery('english', ${query})::text || ':*'))`.as(
            'simple_query',
          ),
      })
      .from(sql`(SELECT 1) as dummy`),
  );

  const avatarObjectsInStorage = aliasedTable(
    objectsInStorage,
    'avatarObjectsInStorage',
  );

  const results = await db
    .with(searchQueries)
    .select({
      ...getTableColumns(organizations),
      avatarImage: avatarObjectsInStorage,
      rank: sql`ts_rank(${organizations.search}, ${searchQueries.englishQuery}) + ts_rank(${organizations.search}, ${searchQueries.simpleQuery})`.as(
        'rank',
      ),
    })
    .from(organizations)
    .crossJoin(searchQueries)
    .leftJoin(
      avatarObjectsInStorage,
      eq(avatarObjectsInStorage.id, organizations.avatarImageId),
    )
    .where(
      sql`${organizations.search} @@ ${searchQueries.englishQuery} OR ${organizations.search} @@ ${searchQueries.simpleQuery}`,
    )
    .limit(limit)
    .orderBy(sql`rank DESC`);

  return results;
};
