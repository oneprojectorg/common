import { and, db, eq } from '@op/db/client';
import { postReactions } from '@op/db/schema';

export interface GetExistingReactionOptions {
  postId: string;
  profileId: string;
}

export const getExistingReaction = async (
  options: GetExistingReactionOptions,
) => {
  const { postId, profileId } = options;
  const existingReaction = await db
    .select()
    .from(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.profileId, profileId),
      ),
    )
    .limit(1);

  return existingReaction[0] || null;
};
