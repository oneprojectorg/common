import { aliasedTable, db, eq, getTableColumns, sql } from '@op/db/client';
import { objectsInStorage, organizations, profiles } from '@op/db/schema';
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
      ...getTableColumns(profiles),
      avatarImage: avatarObjectsInStorage,
      rank: sql`ts_rank(${profiles.search}, ${searchQueries.englishQuery}) + ts_rank(${profiles.search}, ${searchQueries.simpleQuery})`.as(
        'rank',
      ),
    })
    .from(organizations)
    .crossJoin(searchQueries)
    .leftJoin(profiles, eq(organizations.profileId, profiles.id))
    .leftJoin(
      avatarObjectsInStorage,
      eq(avatarObjectsInStorage.id, profiles.avatarImageId),
    )
    .where(
      sql`${profiles.search} @@ ${searchQueries.englishQuery} OR ${profiles.search} @@ ${searchQueries.simpleQuery}`,
    )
    .limit(limit)
    .orderBy(sql`rank DESC`);

  return results;
};
