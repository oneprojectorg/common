import { aliasedTable, db, eq, getTableColumns, sql } from '@op/db/client';
import {
  EntityType,
  objectsInStorage,
  organizations,
  profiles,
  users,
} from '@op/db/schema';

export const searchProfiles = async ({
  query = '',
  limit = 10,
  types,
}: {
  query?: string;
  limit?: number;
  types?: EntityType[];
}) => {
  if (!types) {
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

  const searchByType = async (type: EntityType) =>
    await db
      .with(searchQueries)
      .select({
        ...getTableColumns(profiles),
        //@ts-ignore
        avatarImage: avatarObjectsInStorage,
        organization: {
          ...getTableColumns(organizations),
        },
        user: {
          ...getTableColumns(users),
        },
        rank: sql`ts_rank(${profiles.search}, ${searchQueries.englishQuery}) + ts_rank(${profiles.search}, ${searchQueries.simpleQuery})`.as(
          'rank',
        ),
      })
      .from(profiles)
      .crossJoin(searchQueries)
      .leftJoin(
        avatarObjectsInStorage,
        eq(avatarObjectsInStorage.id, profiles.avatarImageId),
      )
      .leftJoin(organizations, eq(organizations.profileId, profiles.id))
      .leftJoin(users, eq(users.profileId, profiles.id))
      .where(
        sql`(${profiles.search} @@ ${searchQueries.englishQuery} OR ${profiles.search} @@ ${searchQueries.simpleQuery})${sql` AND ${eq(profiles.type, type)}`}`,
      )
      .limit(limit)
      .orderBy(sql`rank DESC`);

  return await Promise.all(
    types.map(async (type) => ({
      type,
      results: await searchByType(type),
    })),
  );
};
