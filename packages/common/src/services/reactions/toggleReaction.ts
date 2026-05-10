import { EntityType } from '@op/db/schema';

import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { decisionPermission } from '../decision/permissions';
import { loadPostContext, type PostContext } from '../posts/postContext';
import { addReaction } from './addReaction';
import { getExistingReaction } from './getExistingReaction';
import { removeReaction } from './removeReaction';

export interface ToggleReactionOptions {
  user: { id: string };
  postId: string;
  reactionType: string;
}

export type ToggleReactionResult = {
  action: 'added' | 'removed' | 'replaced';
  context: PostContext;
};

export const toggleReaction = async ({
  user,
  postId,
  reactionType,
}: ToggleReactionOptions): Promise<ToggleReactionResult> => {
  const context = await loadPostContext(postId);

  await assertProfileTypeAccess({
    user,
    profileIds: context.associatedProfileIds,
    policies: {
      [EntityType.DECISION]: {
        decisions: decisionPermission.SUBMIT_PROPOSALS,
      },
    },
  });

  const profileId = await getCurrentProfileId(user.id);
  const existingReaction = await getExistingReaction({ postId, profileId });

  if (existingReaction) {
    if (existingReaction.reactionType === reactionType) {
      await removeReaction({ postId, profileId });
      return { action: 'removed', context };
    }
    await addReaction({ postId, profileId, reactionType });
    return { action: 'replaced', context };
  }

  await addReaction({ postId, profileId, reactionType });
  return { action: 'added', context };
};
