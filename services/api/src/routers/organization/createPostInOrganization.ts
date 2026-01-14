import { createPostInOrganization } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { trackUserPost } from '../../utils/analytics';

const outputSchema = postsEncoder;

export const createPostInOrganizationRouter = router({
  createPost: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 3 },
  })
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

      return outputSchema.parse(result);
    }),
});
