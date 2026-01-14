import {
  listAllRelatedOrganizationPosts,
  listRelatedOrganizationPosts,
} from '@op/common';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders';
import {
  postsEncoder,
  postsToOrganizationsEncoder,
} from '../../encoders/posts';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = z.object({
  organizationId: z.uuid({
    error: 'Invalid organization ID',
  }),
});

export const listRelatedOrganizationPostsRouter = router({
  listAllPosts: commonAuthedProcedure()
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
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit = 20, cursor } = input ?? {};

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
        hasMore: result.hasMore,
      };
    }),
  listRelatedPosts: commonAuthedProcedure()
    .input(inputSchema)
    .output(z.array(postsToOrganizationsEncoder))
    .query(async ({ ctx, input }) => {
      const { organizationId } = input;
      const { user } = ctx;

      const result = await listRelatedOrganizationPosts({
        organizationId,
        user,
      });

      return result.map((postToOrg) => ({
        ...postToOrg,
        organization: organizationsWithProfileEncoder.parse(
          postToOrg.organization,
        ),
        post: postsEncoder.parse(postToOrg.post),
      }));
    }),
});
