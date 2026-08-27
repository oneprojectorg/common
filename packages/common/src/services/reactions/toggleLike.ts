import { EntityType } from '@op/db/schema';
import { LIKE_REACTION_TYPE, LIKE_REACTION_TYPES } from '@op/types';

import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { decisionPermission } from '../decision/permissions';
import { loadPostContext, type PostContext } from '../posts/postContext';
import { addReaction } from './addReaction';
import { getExistingReaction } from './getExistingReaction';
import { removeReaction } from './removeReaction';

export interface ToggleLikeOptions {
  user: { id: string };
  postId: string;
}

export type ToggleLikeResult = {
  action: 'added' | 'removed';
  context: PostContext;
};

/**
 * Toggles the current user's like on a post or comment.
 *
 * A caller can still be holding a pre-like reaction row. If it is one of the
 * types that counts as a like, the toggle removes it; if it is one of the types
 * that does not (a thumbs-down), the caller has not liked yet, so this replaces
 * that row with a like.
 */
export const toggleLike = async ({
  user,
  postId,
}: ToggleLikeOptions): Promise<ToggleLikeResult> => {
  const context = await loadPostContext(postId);

  // Prefer the pinned rootProfileId gate; fall back to associations for
  // legacy posts that predate the rootProfileId column.
  const profileIdsToAuthorize = context.rootProfileId
    ? [context.rootProfileId]
    : context.associatedProfileIds;

  await assertProfileTypeAccess({
    user,
    profileIds: profileIdsToAuthorize,
    policies: {
      [EntityType.DECISION]: {
        decisions: decisionPermission.SUBMIT_PROPOSALS,
      },
    },
  });

  const profileId = await getCurrentProfileId(user.id);
  const existingReaction = await getExistingReaction({ postId, profileId });

  if (
    existingReaction &&
    LIKE_REACTION_TYPES.includes(existingReaction.reactionType)
  ) {
    await removeReaction({ postId, profileId });
    return { action: 'removed', context };
  }

  await addReaction({
    postId,
    profileId,
    reactionType: LIKE_REACTION_TYPE,
  });

  return { action: 'added', context };
};
