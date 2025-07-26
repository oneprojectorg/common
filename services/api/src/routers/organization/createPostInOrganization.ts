import { createPostInOrganization } from '@op/common';
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
      const result = await createPostInOrganization({
        id: input.id,
        content: input.content,
        attachmentIds: input.attachmentIds,
        user: ctx.user,
      });

      // Handle analytics tracking here in router since it's API-specific
      const { trackUserPost } = await import('@op/analytics');
      const { waitUntil } = await import('@vercel/functions');
      
      // We need to fetch attachments for analytics if they exist
      if (input.attachmentIds.length > 0) {
        const { db } = await import('@op/db/client');
        const allStorageObjects = await db.query.objectsInStorage.findMany({
          where: (table, { inArray }) => inArray(table.id, input.attachmentIds),
        });
        waitUntil(trackUserPost(ctx.user.id, input.content, allStorageObjects));
      } else {
        waitUntil(trackUserPost(ctx.user.id, input.content, []));
      }

      return outputSchema.parse(result);
    }),
});
