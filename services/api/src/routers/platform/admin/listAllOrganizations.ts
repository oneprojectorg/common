import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '@op/common';
import { and, count, db, ilike, inArray, sql } from '@op/db/client';
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

      const [allOrgs, totalCount] = await Promise.all([
        db.query.organizations.findMany({
          // Use RAW callback so column references use the aliased table
          // (Drizzle v2 relational queries alias tables as d0, d1…)
          where: {
            RAW: (table) => {
              const cursorCond = cursorValue
                ? getGenericCursorCondition({
                    columns: { id: table.id, date: table.createdAt },
                    cursor: {
                      date: new Date(cursorValue.date),
                      id: cursorValue.id,
                    },
                  })
                : undefined;

              const searchCond = matchingProfileIds
                ? inArray(table.profileId, matchingProfileIds)
                : undefined;

              if (cursorCond && searchCond) {
                return and(cursorCond, searchCond)!;
              }
              return cursorCond ?? searchCond ?? sql`true`;
            },
          },
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
          orderBy: { createdAt: dir === 'asc' ? 'asc' : 'desc' },
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
