import { insertReaction } from './addReaction';
import { getExistingReaction } from './getExistingReaction';
import type { PostContext } from './reactionAuth';
import { authorizeReactionForPost } from './reactionAuth';
import { deleteReaction } from './removeReaction';

export interface ToggleReactionOptions {
  user: { id: string };
  postId: string;
  reactionType: string;
}

export type ToggleReactionAction = 'added' | 'removed' | 'replaced';

export const toggleReaction = async ({
  user,
  postId,
  reactionType,
}: ToggleReactionOptions): Promise<{
  action: ToggleReactionAction;
  context: PostContext;
}> => {
  // One auth pass — internal add/remove dispatch use the lower-level helpers
  // so we don't re-authorize for the same request.
  const { context, profileId } = await authorizeReactionForPost({
    user,
    postId,
  });

  const existingReaction = await getExistingReaction({ postId, profileId });

  if (existingReaction) {
    if (existingReaction.reactionType === reactionType) {
      await deleteReaction({ postId, profileId });
      return { action: 'removed', context };
    }
    await insertReaction({ postId, profileId, reactionType });
    return { action: 'replaced', context };
  }

  await insertReaction({ postId, profileId, reactionType });
  return { action: 'added', context };
};
