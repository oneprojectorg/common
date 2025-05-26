import { decodeCursor, encodeCursor } from '@op/common';
import { organizations } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { and, eq, lt, or } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization',
    protect: true,
    tags: ['organization'],
    summary: 'List organizations',
  },
};

export const listOrganizationsRouter = router({
  list: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(
      dbFilter
        .extend({
          terms: z.array(z.string()).nullish(),
          cursor: z.string().nullish(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(organizationsEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { limit = 10, cursor } = input ?? {};

      // Parse cursor
      const cursorData = cursor ? decodeCursor(cursor) : null;

      // Build cursor condition for unfiltered query
      const cursorCondition = cursorData
        ? or(
            lt(organizations.updatedAt, cursorData.updatedAt),
            and(
              eq(organizations.updatedAt, cursorData.updatedAt),
              lt(organizations.id, cursorData.id),
            ),
          )
        : undefined;

      // TODO: assert authorization, setup a common package
      const result = await db.query.organizations.findMany({
        where: cursorCondition,
        with: {
          projects: true,
          links: true,
          headerImage: true,
          avatarImage: true,
        },
        orderBy: (orgs, { desc }) => desc(orgs.updatedAt),
        limit: limit + 1, // Fetch one extra to check hasMore
      });

      if (!result) {
        throw new TRPCError({
          message: 'Organizations not found',
          code: 'NOT_FOUND',
        });
      }

      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem && lastItem.updatedAt
          ? encodeCursor(new Date(lastItem.updatedAt), lastItem.id)
          : null;

      return {
        items: items.map((org) => organizationsEncoder.parse(org)),
        next: nextCursor,
        hasMore,
      };
    }),
});
