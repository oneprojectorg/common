import { cache } from '@op/cache';
import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '@op/common';
import { and, count, db, ilike, inArray } from '@op/db/client';
import { organizations, profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import crypto from 'crypto';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

const adminOrgEncoder = createSelectSchema(organizations)
  .pick({
    id: true,
    orgType: true,
    domain: true,
    networkOrganization: true,
    createdAt: true,
  })
  .extend({
    profile: z
      .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
      })
      .nullish(),
  });

export type AdminOrg = z.infer<typeof adminOrgEncoder>;

export const listAllOrganizationsRouter = router({
  listAllOrganizations: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      dbFilter
        .extend({
          /** string for searching organizations by name */
          query: z.string().optional(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(adminOrgEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
        total: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, dir = 'desc', query, limit } = input ?? {};

      // Cursor-based pagination using createdAt timestamp
      const cursorCondition = cursor
        ? getGenericCursorCondition({
            columns: {
              id: organizations.id,
              date: organizations.createdAt,
            },
            cursor: decodeCursor(cursor),
          })
        : undefined;

      // For search, use a subquery to find profiles matching the name
      const profileSubquery =
        query && query.length >= 2
          ? db
              .select({ id: profiles.id })
              .from(profiles)
              .where(ilike(profiles.name, `%${query}%`))
          : null;

      const searchCondition = profileSubquery
        ? inArray(organizations.profileId, profileSubquery)
        : undefined;

      const whereCondition =
        searchCondition && cursorCondition
          ? and(cursorCondition, searchCondition)
          : searchCondition || cursorCondition;

      const [allOrgs, totalCountResult] = await Promise.all([
        db._query.organizations.findMany({
          where: whereCondition,
          with: {
            profile: {
              columns: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: (_, { asc, desc }) =>
            dir === 'asc'
              ? asc(organizations.createdAt)
              : desc(organizations.createdAt),
          ...(limit !== undefined && { limit: limit + 1 }),
        }),
        cache<{ value: number }>({
          type: 'organization',
          params: [
            'admin-search-total-' + (query ? hashSearch(query) : 'all'),
          ],
          fetch: async () => {
            const [result] = await db
              .select({ value: count() })
              .from(organizations)
              .where(searchCondition);
            return result ?? { value: 0 };
          },
          options: {
            ttl: 1 * 60 * 1000, // 1 min
            skipMemCache: true,
          },
        }),
      ]);

      const totalCount = totalCountResult.value ?? 0;
      const hasMore = limit !== undefined && allOrgs.length > limit;
      const items = hasMore ? allOrgs.slice(0, limit) : allOrgs;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem && lastItem.createdAt
          ? encodeCursor({
              date: new Date(lastItem.createdAt),
              id: lastItem.id,
            })
          : null;

      return {
        items: items.map((org) => adminOrgEncoder.parse(org)),
        next: nextCursor,
        hasMore,
        total: totalCount,
      };
    }),
});

/** Utility to hash search strings for cache keys */
function hashSearch(search: string) {
  return crypto.createHash('md5').update(search).digest('hex').substring(0, 16);
}
