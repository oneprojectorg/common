import { listAllRelatedOrganizationPosts } from '@op/common';
import { PAGE_LIMIT } from '@op/common/client';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders';
import {
  postsEncoder,
  postsToOrganizationsEncoder,
} from '../../encoders/posts';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

export const listRelatedOrganizationPostsRouter = router({
  listAllPosts: networkAuthenticatedProcedure()
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
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit = PAGE_LIMIT.md, cursor } = input ?? {};

      const result = await listAllRelatedOrganizationPosts(ctx.user.id, {
        limit,
        cursor,
      });

      return {
        items: result.items.map((postToOrg) => ({
          ...postToOrg,
          organization: organizationsWithProfileEncoder.parse(
            postToOrg.organization,
          ),
          post: postsEncoder.parse(postToOrg.post),
        })),
        next: result.next,
      };
    }),
});
