import { getOrganizationPosts as getOrganizationPostsService } from '@op/common';
import { getOrganizationPostsSchema } from '@op/types';
import { z } from 'zod';

import { postsToOrganizationsEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const outputSchema = z.array(postsToOrganizationsEncoder);

export const getOrganizationPosts = router({
  getOrganizationPosts: commonAuthedProcedure()
    .input(getOrganizationPostsSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      const posts = await getOrganizationPostsService({
        ...input,
        authUserId: ctx.user.id,
      });
      return outputSchema.parse(posts);
    }),
});
