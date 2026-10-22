import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';
import { Events, event } from '@op/events';
import { logger } from '@op/logging';
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

    // Then add the new reaction. Two concurrent likes both delete nothing and
    // both insert the same (post, profile, 'like') key, so the loser of that
    // race would hit the unique index — it already has what it wanted.
    await tx
      .insert(postReactions)
      .values({
        postId,
        profileId,
        reactionType,
      })
      .onConflictDoNothing();
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
        logger.error('[addReaction] Failed to emit postReactionAdded event', {
          error,
        });
      }),
  );
};
