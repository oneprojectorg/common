import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';
import { event } from '@op/events';

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
  });

  // sending this only on transaction success
  await event.send({
    name: 'post/reaction-added',
    data: {
      sourceProfileId: profileId,
      postId,
      reactionType,
    },
  });
};
