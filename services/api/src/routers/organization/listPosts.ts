import { listPosts } from '@op/common';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders';
import {
  postsEncoder,
  postsToOrganizationsEncoder,
} from '../../encoders/posts';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = dbFilter.extend({
  slug: z.string(),
  cursor: z.string().nullish(),
});

export const listOrganizationPostsRouter = router({
  listPosts: commonAuthedProcedure()
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
        authUserId: ctx.user.id,
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
