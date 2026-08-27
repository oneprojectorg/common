import { and, db, eq, inArray } from '@op/db/client';
import { postReactions } from '@op/db/schema';
import { LIKE_REACTION_TYPES } from '@op/types';

export interface RemoveReactionOptions {
  postId: string;
  profileId: string;
}

/**
 * Deletes the profile's like on a post and reports whether there was one.
 *
 * Scoped to the types that count as a like so a legacy thumbs-down is left
 * alone — the caller reads that as "not liked yet". The delete is a single
 * statement, so two concurrent toggles can't both see the row and both remove
 * it: exactly one gets a non-empty result.
 */
export const removeReaction = async ({
  postId,
  profileId,
}: RemoveReactionOptions): Promise<{ removed: boolean }> => {
  const deleted = await db
    .delete(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.profileId, profileId),
        inArray(postReactions.reactionType, LIKE_REACTION_TYPES),
      ),
    )
    .returning({ id: postReactions.id });

  return { removed: deleted.length > 0 };
};
