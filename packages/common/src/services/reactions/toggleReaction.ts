import { addReaction } from './addReaction';
import { getExistingReaction } from './getExistingReaction';
import { removeReaction } from './removeReaction';

export interface ToggleReactionOptions {
  postId: string;
  profileId: string;
  reactionType: string;
}

export const toggleReaction = async (options: ToggleReactionOptions) => {
  const { postId, profileId, reactionType } = options;
  
  const existingReaction = await getExistingReaction({ postId, profileId });

  if (existingReaction) {
    // If user has the same reaction type, remove it
    if (existingReaction.reactionType === reactionType) {
      await removeReaction({ postId, profileId });
      return { success: true, action: 'removed' as const };
    } else {
      // If user has a different reaction type, replace it
      await addReaction({ postId, profileId, reactionType });
      return { success: true, action: 'replaced' as const };
    }
  } else {
    // No existing reaction, add new one
    await addReaction({ postId, profileId, reactionType });
    return { success: true, action: 'added' as const };
  }
};
