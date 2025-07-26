import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';

export const addReaction = async (
  postId: string,
  profileId: string,
  reactionType: string,
) => {
  // First, remove any existing reaction from this user on this post
  await db
    .delete(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.profileId, profileId),
      ),
    );

  // Then add the new reaction
  await db.insert(postReactions).values({
    postId,
    profileId,
    reactionType,
  });
};
