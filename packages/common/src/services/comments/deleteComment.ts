import { db } from '@op/db/client';
import { comments } from '@op/db/schema';
import type { DeleteCommentInput } from '@op/types';
import { and, eq } from 'drizzle-orm';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';

export const deleteComment = async (input: DeleteCommentInput) => {
  const profileId = await getCurrentProfileId();

  if (!profileId) {
    throw new UnauthorizedError();
  }

  try {
    const [deletedComment] = await db
      .delete(comments)
      .where(and(eq(comments.id, input.id), eq(comments.profileId, profileId)))
      .returning();

    if (!deletedComment) {
      throw new NotFoundError('Comment not found or you do not have permission to delete it');
    }

    return { success: true, message: 'Comment deleted successfully' };
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};