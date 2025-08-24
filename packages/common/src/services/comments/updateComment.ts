import { db } from '@op/db/client';
import { comments } from '@op/db/schema';
import type { UpdateCommentInput } from '@op/types';
import { and, eq } from 'drizzle-orm';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';

export const updateComment = async (input: UpdateCommentInput) => {
  const { authUserId } = input;
  
  const profileId = await getCurrentProfileId(authUserId);

  if (!profileId) {
    throw new UnauthorizedError();
  }

  try {
    const [comment] = await db
      .update(comments)
      .set({
        content: input.content,
      })
      .where(and(eq(comments.id, input.id), eq(comments.profileId, profileId)))
      .returning();

    if (!comment) {
      throw new NotFoundError(
        'Comment not found or you do not have permission to update it',
      );
    }

    return comment;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};
