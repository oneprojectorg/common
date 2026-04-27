import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';
import { Events, event } from '@op/events';

import type { PostContext } from './reactionAuth';
import { authorizeReactionForPost } from './reactionAuth';

interface InsertReactionOptions {
  postId: string;
  profileId: string;
  reactionType: string;
}

// Lower-level: writes the reaction and fires the event with no auth check.
// Used by `addReaction` (auth-aware public API) and by `toggleReaction`,
// which authorizes once and dispatches.
export const insertReaction = async ({
  postId,
  profileId,
  reactionType,
}: InsertReactionOptions) => {
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
    name: Events.postReactionAdded.name,
    data: {
      sourceProfileId: profileId,
      postId,
      reactionType,
    },
  });
};

export interface AddReactionOptions {
  user: { id: string };
  postId: string;
  reactionType: string;
}

export const addReaction = async ({
  user,
  postId,
  reactionType,
}: AddReactionOptions): Promise<{ context: PostContext }> => {
  const { context, profileId } = await authorizeReactionForPost({
    user,
    postId,
  });
  await insertReaction({ postId, profileId, reactionType });
  return { context };
};
