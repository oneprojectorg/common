import { decodeCursor, encodeCursor } from '@op/common';
import { and, count, db, eq, ilike, inArray, lt, or } from '@op/db/client';
import { organizations, profiles } from '@op/db/schema';
import { z } from 'zod';

import { adminOrgEncoder } from '../../../encoders';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

type OrganizationMemberNameSource = {
  name: string | null;
  serviceUser?: {
    name: string | null;
    profile?: {
      name: string | null;
    } | null;
  } | null;
};

const getMemberDisplayName = (member: OrganizationMemberNameSource) => {
  return (
    member.name ?? member.serviceUser?.profile?.name ?? member.serviceUser?.name
  );
};

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
        total: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, dir = 'desc', query, limit } = input ?? {};
      const cursorValue = cursor
        ? decodeCursor<{ date: string; id: string }>(cursor)
        : undefined;

      // For search, fetch matching profile IDs
      const matchingProfileIds =
        query && query.length >= 2
          ? (
              await db
                .select({ id: profiles.id })
                .from(profiles)
                .where(ilike(profiles.name, `%${query}%`))
            ).map((p) => p.id)
          : null;

      // Build cursor condition for keyset pagination
      const cursorCondition = cursorValue
        ? or(
            lt(organizations.createdAt, cursorValue.date),
            and(
              eq(organizations.createdAt, cursorValue.date),
              lt(organizations.id, cursorValue.id),
            ),
          )
        : undefined;

      const searchCondition = matchingProfileIds
        ? inArray(organizations.profileId, matchingProfileIds)
        : undefined;

      const whereCondition =
        cursorCondition && searchCondition
          ? and(cursorCondition, searchCondition)
          : cursorCondition || searchCondition;

      const [allOrgs, totalCount] = await Promise.all([
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
            organizationUsers: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
              with: {
                serviceUser: {
                  columns: {
                    name: true,
                  },
                  with: {
                    profile: {
                      columns: {
                        name: true,
                      },
                    },
                  },
                },
                roles: {
                  with: {
                    accessRole: {
                      columns: {
                        id: true,
                        name: true,
                        description: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: (_, { asc, desc }) =>
            dir === 'asc'
              ? asc(organizations.createdAt)
              : desc(organizations.createdAt),
          ...(limit !== undefined && { limit: limit + 1 }),
        }),
        db
          .select({ value: count() })
          .from(organizations)
          .where(
            matchingProfileIds
              ? inArray(organizations.profileId, matchingProfileIds)
              : undefined,
          )
          .then(([result]) => result?.value ?? 0),
      ]);

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
        items: items.map((org) =>
          adminOrgEncoder.parse({
            ...org,
            members:
              org.organizationUsers?.map((member) => ({
                ...member,
                name: getMemberDisplayName(member),
              })) ?? [],
          }),
        ),
        next: nextCursor,
        total: totalCount,
      };
    }),
});
