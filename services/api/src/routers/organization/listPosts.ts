import { decodeCursor, encodeCursor } from '@op/common';
import { postsToOrganizations } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { and, eq, lt, or } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders';
import {
  postsEncoder,
  postsToOrganizationsEncoder,
} from '../../encoders/posts';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = z.object({
  slug: z.string(),
  limit: z.number().min(1).max(50).default(10),
  cursor: z.string().nullish(),
});
const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{slug}/feed/posts',
    protect: true,
    tags: ['organization'],
    summary: 'List posts for an organization',
  },
};

export const listOrganizationPostsRouter = router({
  listPosts: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(
      z.object({
        items: z.array(postsToOrganizationsEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { slug, limit, cursor } = input;

      const org = await db.query.organizations.findFirst({
        where: (table, { eq }) => eq(table.slug, slug),
      });

      if (!org) {
        throw new TRPCError({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }

      // Parse cursor
      const cursorData = cursor ? decodeCursor(cursor) : null;

      // Build cursor condition for pagination
      const cursorCondition = cursorData
        ? or(
            lt(postsToOrganizations.createdAt, cursorData.createdAt),
            and(
              eq(postsToOrganizations.createdAt, cursorData.createdAt),
              lt(postsToOrganizations.postId, cursorData.id),
            ),
          )
        : undefined;

      const result = await db.query.postsToOrganizations.findMany({
        where: cursorCondition 
          ? and(eq(postsToOrganizations.organizationId, org.id), cursorCondition)
          : (table, { eq }) => eq(table.organizationId, org.id),
        with: {
          post: {
            with: {
              attachments: {
                with: {
                  storageObject: true,
                },
              },
            },
          },
          organization: {
            with: {
              avatarImage: true,
            },
          },
        },
        orderBy: (table, { desc }) => desc(table.createdAt),
        limit: limit + 1, // Fetch one extra to check hasMore
      });

      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem && lastItem.createdAt
          ? encodeCursor(new Date(lastItem.createdAt), lastItem.postId)
          : null;

      return {
        items: items.map((postToOrg) => ({
          ...postToOrg,
          organization: organizationsEncoder.parse(postToOrg.organization),
          post: postsEncoder.parse(postToOrg.post),
        })),
        next: nextCursor,
        hasMore,
      };
    }),
});
