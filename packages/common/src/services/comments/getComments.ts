import { db } from '@op/db/client';
import { comments } from '@op/db/schema';
import type { GetCommentsInput } from '@op/types';
import { desc } from 'drizzle-orm';

export const getComments = async (input: GetCommentsInput) => {
  try {
    const commentsData = await db.query.comments.findMany({
      where: (table, { eq }) => eq(table.postId, input.postId),
      orderBy: [desc(comments.createdAt)],
      limit: input.limit,
      offset: input.offset,
      with: {
        profile: true,
        parentComment: true,
        childComments: true,
      },
    });

    return commentsData;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};