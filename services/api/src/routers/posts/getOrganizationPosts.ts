import { getOrganizationPosts as getOrganizationPostsService } from '@op/common';
import { getOrganizationPostsSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { postsToOrganizationsEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const outputSchema = z.array(postsToOrganizationsEncoder);

export const getOrganizationPosts = router({
  getOrganizationPosts: commonAuthedProcedure()
    .input(getOrganizationPostsSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const posts = await getOrganizationPostsService({
          ...input,
          authUserId: ctx.user.id,
        });
        const output = outputSchema.parse(posts);
        return output;
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when fetching organization posts',
        });
      }
    }),
});
