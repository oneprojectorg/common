import { db } from '@op/db/client';
import { comments, commentsToPost, commentsToProjects } from '@op/db/schema';
import type { GetCommentsInput } from '@op/types';
import { desc, eq } from 'drizzle-orm';

export const getComments = async (input: GetCommentsInput) => {
  try {
    let commentsData;

    if (input.commentableType === 'post') {
      // Query comments for posts via join table
      commentsData = await db
        .select({
          id: comments.id,
          content: comments.content,
          profileId: comments.profileId,
          parentCommentId: comments.parentCommentId,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
        })
        .from(comments)
        .innerJoin(commentsToPost, eq(comments.id, commentsToPost.commentId))
        .where(eq(commentsToPost.postId, input.commentableId))
        .orderBy(desc(comments.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    } else if (input.commentableType === 'project') {
      // Query comments for projects via join table
      commentsData = await db
        .select({
          id: comments.id,
          content: comments.content,
          profileId: comments.profileId,
          parentCommentId: comments.parentCommentId,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
        })
        .from(comments)
        .innerJoin(commentsToProjects, eq(comments.id, commentsToProjects.commentId))
        .where(eq(commentsToProjects.projectId, input.commentableId))
        .orderBy(desc(comments.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    } else {
      throw new Error(`Unsupported commentable type: ${input.commentableType}`);
    }

    return commentsData;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};