import { trackUserPost } from '@op/analytics';
import { createPostInOrganization } from '@op/common';
import { waitUntil } from '@vercel/functions';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

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
    // Router
    // .meta(meta)
    .input(
      z.object({
        id: z.string(),
        content: z.string().trim().max(255),
        attachmentIds: z.array(z.string()).optional().default([]),
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

      waitUntil(trackUserPost(ctx.user.id, input.content, allStorageObjects));

      return outputSchema.parse(result);
    }),
});
