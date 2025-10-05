import { z } from 'zod';

export const PostLikedEventSchema = z.object({
  name: z.literal('post/liked'),
  data: z.object({
    sourceProfileId: z.string(),
    postId: z.string(),
    reactionType: z.string(),
  }),
});

export type PostLikedEvent = z.infer<typeof PostLikedEventSchema>;

/**
 * Union type of all possible events
 */
export type AppEvent = PostLikedEvent;
