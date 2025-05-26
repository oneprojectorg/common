import { TRPCError } from '@trpc/server';
import { and, inArray, lt, or, eq } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';
import { organizations } from '../../../../db/schema/tables/organizations.sql';

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
        nextCursor: z.string().nullish(),
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { limit = 10, terms = [], cursor } = input ?? {};

      // Cursor utilities
      const decodeCursor = (cursor: string) => {
        try {
          return JSON.parse(Buffer.from(cursor, 'base64').toString());
        } catch {
          throw new TRPCError({
            message: 'Invalid cursor',
            code: 'BAD_REQUEST',
          });
        }
      };

      const encodeCursor = (updatedAt: Date, id: string) => {
        return Buffer.from(JSON.stringify({ updatedAt, id })).toString('base64');
      };

      // Parse cursor if provided
      const cursorData = cursor ? decodeCursor(cursor) : null;

      if (terms?.length) {
        const result = await db.query.organizationsTerms.findMany({
          where: (table) => inArray(table.taxonomyTermId, terms),
          // with: {
          // organization: {
          // // links: true,
          // headerImage: true,
          // avatarImage: true,
          // },
          // },
        });

        console.log('TERMS', terms, result);
        
        // Build cursor condition for filtered query
        const cursorCondition = cursorData
          ? or(
              lt(organizations.updatedAt, cursorData.updatedAt),
              and(
                eq(organizations.updatedAt, cursorData.updatedAt),
                lt(organizations.id, cursorData.id),
              ),
            )
          : undefined;

        const whereCondition = cursorCondition
          ? and(
              inArray(
                organizations.id,
                result.map((r) => r.organizationId),
              ),
              cursorCondition,
            )
          : inArray(
              organizations.id,
              result.map((r) => r.organizationId),
            );

        const orgs = await db.query.organizations.findMany({
          where: whereCondition,
          with: {
            projects: true,
            links: true,
            headerImage: true,
            avatarImage: true,
          },
          orderBy: (orgs, { desc }) => desc(orgs.updatedAt),
          limit: limit + 1, // Fetch one extra to check hasMore
        });

        const hasMore = orgs.length > limit;
        const items = hasMore ? orgs.slice(0, limit) : orgs;
        const lastItem = items[items.length - 1];
        const nextCursor = hasMore && lastItem && lastItem.updatedAt
          ? encodeCursor(new Date(lastItem.updatedAt), lastItem.id)
          : null;

        return {
          items: items.map((org) => organizationsEncoder.parse(org)),
          nextCursor,
          hasMore,
        };
      }

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
      const nextCursor = hasMore && lastItem && lastItem.updatedAt
        ? encodeCursor(new Date(lastItem.updatedAt), lastItem.id)
        : null;

      return {
        items: items.map((org) => organizationsEncoder.parse(org)),
        nextCursor,
        hasMore,
      };
    }),
});
