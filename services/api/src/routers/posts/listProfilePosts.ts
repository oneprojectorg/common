import {
  Channels,
  MAX_PAGE_LIMIT,
  listProfilePosts as listProfilePostsService,
} from '@op/common';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import { openProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string(),
  limit: z.number().int().positive().max(MAX_PAGE_LIMIT).optional(),
  cursor: z.string().nullish(),
});

export const listProfilePosts = router({
  /** Lists a decision profile's update posts (public on a public decision). */
  listProfilePosts: openProcedure()
    .input(inputSchema)
    .output(
      z.object({
        items: z.array(postsEncoder),
        next: z.string().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { items, next } = await listProfilePostsService({
        ...input,
        user: ctx.user,
      });

      ctx.registerQueryChannels([Channels.profilePosts(input.profileId)]);

      return {
        items: items.map((post) => postsEncoder.parse(post)),
        next,
      };
    }),
});
