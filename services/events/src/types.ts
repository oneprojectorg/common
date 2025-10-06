import { z } from 'zod';

export const EventNames = {
  POST_REACTION_ADDED: 'post/reaction-added',
} as const;

export const PostReactionAddedEventSchema = z.object({
  name: z.literal(EventNames.POST_REACTION_ADDED),
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
