import { listPosts } from '@op/common';
import { PAGE_LIMIT } from '@op/common/client';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders';
import {
  postsEncoder,
  postsToOrganizationsEncoder,
} from '../../encoders/posts';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = dbFilter.extend({
  slug: z.string(),
  cursor: z.string().nullish(),
});

export const listOrganizationPostsRouter = router({
  listPosts: networkAuthenticatedProcedure()
    .input(inputSchema)
    .output(
      z.object({
        items: z.array(postsToOrganizationsEncoder),
        next: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { slug, limit = PAGE_LIMIT.md, cursor } = input;

      const { items, next } = await listPosts({
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
      };
    }),
});
