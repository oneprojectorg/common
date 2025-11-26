import { createPostInOrganization } from '@op/common';
import { Channels } from '@op/realtime';
import { realtime } from '@op/realtime/server';
import { waitUntil } from '@vercel/functions';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { getTRPCQueryKey } from '../../utils';
import { trackUserPost } from '../../utils/analytics';

// const meta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'POST',
// path: '/organization/{id}/posts',
// protect: true,
// tags: ['organization', 'post'],
// summary: 'Add a post to an organization',
// },
// };

const outputSchema = postsEncoder;

export const createPostInOrganizationRouter = router({
  createPost: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    // .meta(meta)
    .input(
      z.object({
        id: z.string(), // the organization id
        content: z.string().trim().max(255),
        attachmentIds: z.array(z.string()).optional().prefault([]),
      }),
    )
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      const { result, allStorageObjects } = await createPostInOrganization({
        id: input.id,
        content: input.content,
        attachmentIds: input.attachmentIds,
        user: ctx.user,
      });

      waitUntil(trackUserPost(ctx, input.content, allStorageObjects));

      // Publish realtime invalidation for all posts feed
      waitUntil(
        realtime.publish(Channels.global(), {
          type: 'query-invalidation',
          queryKey: getTRPCQueryKey('organization', 'listAllPosts'),
        }),
      );

      return outputSchema.parse(result);
    }),
});
