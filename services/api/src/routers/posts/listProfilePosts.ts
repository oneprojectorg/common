import {
  Channels,
  listProfilePosts as listProfilePostsService,
} from '@op/common';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().nullish(),
});

export const listProfilePosts = router({
  listProfilePosts: commonAuthedProcedure()
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
        authUserId: ctx.user.id,
      });

      ctx.registerQueryChannels([Channels.profilePosts(input.profileId)]);

      return {
        items: items.map((post) => postsEncoder.parse(post)),
        next,
      };
    }),
});
