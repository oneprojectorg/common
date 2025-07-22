import { db } from '@op/db/client';
import { comments } from '@op/db/schema';
import type { CreateCommentInput } from '@op/types';

import { NotFoundError } from '../../utils';
import { getCurrentProfileId } from '../access';

export const createComment = async (input: CreateCommentInput) => {
  const profileId = await getCurrentProfileId();

  try {
    const [comment] = await db
      .insert(comments)
      .values({
        content: input.content,
        postId: input.postId,
        profileId,
        parentCommentId: input.parentCommentId || null,
      })
      .returning();

    if (!comment) {
      throw new NotFoundError('Failed to create comment');
    }

    return comment;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};