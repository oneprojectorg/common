import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';

import type { PostContext } from './reactionAuth';
import { authorizeReactionForPost } from './reactionAuth';

interface DeleteReactionOptions {
  postId: string;
  profileId: string;
}

export const deleteReaction = async ({
  postId,
  profileId,
}: DeleteReactionOptions) => {
  await db
    .delete(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.profileId, profileId),
      ),
    );
};

export interface RemoveReactionOptions {
  user: { id: string };
  postId: string;
}

export const removeReaction = async ({
  user,
  postId,
}: RemoveReactionOptions): Promise<{ context: PostContext }> => {
  const { context, profileId } = await authorizeReactionForPost({
    user,
    postId,
  });
  await deleteReaction({ postId, profileId });
  return { context };
};
