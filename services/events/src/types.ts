import { z } from 'zod';

export const PostReactionAddedEventSchema = z.object({
  name: z.literal('post/reaction-added'),
  data: z.object({
    sourceProfileId: z.string(),
    postId: z.string(),
    reactionType: z.string(),
  }),
});

export type PostReactionAddedEvent = z.infer<
  typeof PostReactionAddedEventSchema
>;

/**
 * Union type of all possible events
 */
export type WorkflowEvent = PostReactionAddedEvent;
