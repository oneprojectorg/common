import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';
import { Events, event } from '@op/events';
import { waitUntil } from '@vercel/functions';

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

  // Defer to the platform's post-response work queue so notification
  // dispatch can't delay or fail the user-facing mutation. The reaction
  // is already persisted above.
  waitUntil(
    event
      .send({
        name: Events.postReactionAdded.name,
        data: {
          sourceProfileId: profileId,
          postId,
          reactionType,
        },
      })
      .catch((error) => {
        console.error(
          '[addReaction] Failed to emit postReactionAdded event',
          error,
        );
      }),
  );
};
