import { createPostInOrganization } from '@op/common';
import { Channels, publishMessage } from '@op/realtime';
import { waitUntil } from '@vercel/functions';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import { getTRPCQueryKey } from '../../lib/getTRPCQueryKey';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
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

      const queryKey = getTRPCQueryKey('organization', 'listAllPosts');

      // Publish to both global and org-specific channels
      waitUntil(
        publishMessage(Channels.global(), {
          type: 'cache-invalidation',
          queryKey: [queryKey],
          timestamp: Date.now(),
        }),
      );

      return outputSchema.parse(result);
    }),
});
