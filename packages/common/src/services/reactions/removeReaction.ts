import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';

export interface RemoveReactionOptions {
  postId: string;
  profileId: string;
}

export const removeReaction = async (options: RemoveReactionOptions) => {
  const { postId, profileId } = options;
  await db
    .delete(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.profileId, profileId),
      ),
    );
};
