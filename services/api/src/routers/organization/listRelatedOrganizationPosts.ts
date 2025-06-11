import {
  decodeCursor,
  encodeCursor,
  getRelatedOrganizations,
} from '@op/common';
import { and, eq, inArray, lt, or } from '@op/db/client';
import { postsToOrganizations } from '@op/db/schema';
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
  organizationId: z.string().uuid({ message: 'Invalid organization ID' }),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{organizationId}/feed',
    protect: true,
    tags: ['organization', 'posts', 'relationships'],
    summary: 'List posts for organizations related to a given organization',
  },
};

const metaAllPosts: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/feed',
    protect: true,
    tags: ['organization', 'posts', 'relationships'],
    summary: 'List posts for organizations related to a given organization',
  },
};

export const listRelatedOrganizationPostsRouter = router({
  listAllPosts: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(metaAllPosts)
    .input(
      dbFilter
        .extend({
          cursor: z.string().nullish(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(postsToOrganizationsEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { limit = 200, cursor } = input ?? {};

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

      // Fetch posts for all organizations with pagination
      const result = await db.query.postsToOrganizations.findMany({
        where: cursorCondition,
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
  listRelatedPosts: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(inputSchema)
    .output(z.array(postsToOrganizationsEncoder))
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { organizationId } = input;
      const { user } = ctx;

      // Get related organizations
      const { records: organizations } = await getRelatedOrganizations({
        user,
        orgId: organizationId,
        pending: false,
      });

      const orgIds = organizations?.map((org: any) => org.id) ?? [];
      orgIds.push(organizationId); // Add our own org so we see our own posts

      // Fetch posts for all related organizations
      const result = await db.query.postsToOrganizations.findMany({
        where: () => inArray(postsToOrganizations.organizationId, orgIds),
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
      });

      return result.map((postToOrg) => ({
        ...postToOrg,
        organization: organizationsEncoder.parse(postToOrg.organization),
        post: postsEncoder.parse(postToOrg.post),
      }));
    }),
});
