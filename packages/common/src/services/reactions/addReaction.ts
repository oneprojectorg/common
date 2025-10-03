import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';
import { event } from '@op/tasks';

export interface AddReactionOptions {
  postId: string;
  profileId: string;
  reactionType: string;
}

export const addReaction = async (options: AddReactionOptions) => {
  const { postId, profileId, reactionType } = options;
  await db.transaction(async (tx) => {
    // First, remove any existing reaction from this user on this post
    await tx
      .delete(postReactions)
      .where(
        and(
          eq(postReactions.postId, postId),
          eq(postReactions.profileId, profileId),
        ),
      );

    // Then add the new reaction
    await tx.insert(postReactions).values({
      postId,
      profileId,
      reactionType,
    });

    await event.send({
      name: 'post/liked',
      data: {
        sourceProfileId: profileId,
        postId,
        reactionType,
      },
    });
  });
};
