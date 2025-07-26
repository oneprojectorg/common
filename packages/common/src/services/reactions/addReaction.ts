import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';

export interface AddReactionOptions {
  postId: string;
  profileId: string;
  reactionType: string;
}

export const addReaction = async (options: AddReactionOptions) => {
  const { postId, profileId, reactionType } = options;
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
