import { db } from '@op/db/client';
import { comments } from '@op/db/schema';
import type { DeleteCommentInput } from '@op/types';
import { eq } from 'drizzle-orm';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';

export const deleteComment = async (input: DeleteCommentInput) => {
  const profileId = await getCurrentProfileId();

  if (!profileId) {
    throw new UnauthorizedError();
  }

  try {
    // First, get the comment to check authorization
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, input.id),
      with: {
        parentComment: true,
      },
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Check if user can delete this comment
    const canDelete = 
      comment.profileId === profileId || // User is the comment author
      (comment.parentComment && 'profileId' in comment.parentComment && comment.parentComment.profileId === profileId); // User is the parent comment author

    if (!canDelete) {
      throw new UnauthorizedError('You do not have permission to delete this comment');
    }

    // Delete the comment
    const [deletedComment] = await db
      .delete(comments)
      .where(eq(comments.id, input.id))
      .returning();

    if (!deletedComment) {
      throw new NotFoundError('Failed to delete comment');
    }

    return { success: true, message: 'Comment deleted successfully' };
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};