import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';

export const removeReaction = async (postId: string, profileId: string) => {
  await db
    .delete(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.profileId, profileId),
      ),
    );
};
