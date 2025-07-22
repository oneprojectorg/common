import { db } from '@op/db/client';
import { comments, commentsToPost } from '@op/db/schema';
import type { CreateCommentInput } from '@op/types';

import { CommonError, NotFoundError } from '../../utils';
import { getCurrentProfileId } from '../access';

export const createComment = async (input: CreateCommentInput) => {
  const profileId = await getCurrentProfileId();

  try {
    // Create the comment first
    const [comment] = await db
      .insert(comments)
      .values({
        content: input.content,
        profileId,
        parentCommentId: input.parentCommentId || null,
      })
      .returning();

    if (!comment) {
      throw new NotFoundError('Failed to create comment');
    }

    // Create the join table entry based on commentableType
    if (input.commentableType === 'post') {
      await db.insert(commentsToPost).values({
        commentId: comment.id,
        postId: input.commentableId,
      });
    } else {
      throw new CommonError(
        `Unsupported commentable type: ${input.commentableType}`,
      );
    }

    return comment;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};
