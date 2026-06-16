import {
  Channels,
  listProposalPosts as listProposalPostsService,
} from '@op/common';
import { z } from 'zod';

import { postsEncoder } from '../../../encoders';
import { openProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().nullish(),
});

export const listProposalPostsRouter = router({
  /**
   * Lists a proposal's discussion posts. Gated on the parent decision's READ
   * (public on a public decision), never on the proposal profile itself —
   * which is why this can't go through `posts.getPosts`, whose policy
   * leniently passes the PROPOSAL profile type.
   */
  listProposalPosts: openProcedure()
    .input(inputSchema)
    .output(
      z.object({
        items: z.array(postsEncoder),
        next: z.string().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { items, next } = await listProposalPostsService({
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
