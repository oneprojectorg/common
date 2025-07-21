import { listPosts } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders';
import {
  postsEncoder,
  postsToOrganizationsEncoder,
} from '../../encoders/posts';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = dbFilter.extend({
  slug: z.string(),
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
      const { slug, limit = 20, cursor } = input;

      const { items, next, hasMore } = await listPosts({
        user: ctx.user,
        slug,
        limit,
        cursor,
      });

      return {
        items: items.map((postToOrg) => ({
          ...postToOrg,
          organization: organizationsWithProfileEncoder.parse(
            postToOrg.organization,
          ),
          post: postsEncoder.parse(postToOrg.post),
        })),
        next,
        hasMore,
      };
    }),
});
