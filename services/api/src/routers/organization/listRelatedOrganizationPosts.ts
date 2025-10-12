import {
  listAllRelatedOrganizationPosts,
  listRelatedOrganizationPosts,
} from '@op/common';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import {
  organizationsEncoder,
  organizationsWithProfileEncoder,
} from '../../encoders';
import {
  postsEncoder,
  postsToOrganizationsEncoder,
} from '../../encoders/posts';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = z.object({
  organizationId: z.uuid({
    error: 'Invalid organization ID',
  }),
});

// const meta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'GET',
// path: '/organization/{organizationId}/feed',
// protect: true,
// tags: ['organization', 'posts', 'relationships'],
// summary: 'List posts for organizations related to a given organization',
// },
// };

// const metaAllPosts: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'GET',
// path: '/organization/feed',
// protect: true,
// tags: ['organization', 'posts', 'relationships'],
// summary: 'List posts for organizations related to a given organization',
// },
// };

export const listRelatedOrganizationPostsRouter = router({
  listAllPosts: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // .meta(metaAllPosts)
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
    .query(async ({ input, ctx }) => {
      const { limit = 200, cursor } = input ?? {};

      const result = await listAllRelatedOrganizationPosts(ctx.user.id, {
        limit,
        cursor,
      });

      return {
        items: result.items.map((postToOrg) => ({
          ...postToOrg,
          organization: organizationsEncoder.parse(postToOrg.organization),
          post: postsEncoder.parse(postToOrg.post),
        })),
        next: result.next,
        hasMore: result.hasMore,
      };
    }),
  listRelatedPosts: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // .meta(meta)
    .input(inputSchema)
    .output(z.array(postsToOrganizationsEncoder))
    .query(async ({ ctx, input }) => {
      const { organizationId } = input;
      const { user } = ctx;

      const result = await listRelatedOrganizationPosts({
        organizationId,
        user,
      });

      return result.map((postToOrg) => ({
        ...postToOrg,
        organization: organizationsWithProfileEncoder.parse(
          postToOrg.organization,
        ),
        post: postsEncoder.parse(postToOrg.post),
      }));
    }),
});
