import { type DbClient, db as defaultDb } from '@op/db/client';
import { posts, postsToProfiles } from '@op/db/schema';
import { logger } from '@op/logging';

import { NotFoundError } from '../../utils';
import { getCurrentProfileId } from '../access';

export interface CreatePostOnProfileInput {
  content: string;
  targetProfileId: string; // The profile where the post will appear
  parentPostId?: string;
  authUserId: string; // User ID for authentication
  db?: DbClient;
}

export const createPostOnProfile = async (input: CreatePostOnProfileInput) => {
  const { authUserId, db = defaultDb } = input;

  const authorProfileId = await getCurrentProfileId(authUserId);

  try {
    // The post and its profile association are one unit — a partial write
    // leaves a post nobody can reach through the target profile's feed.
    return await db.transaction(async (tx) => {
      // Create a post authored by the current user
      const [post] = await tx
        .insert(posts)
        .values({
          content: input.content,
          profileId: authorProfileId, // Author of the post
          parentPostId: input.parentPostId || null,
        })
        .returning();

      if (!post) {
        throw new NotFoundError('Post');
      }

      // Link the post to the target profile so it appears there
      await tx.insert(postsToProfiles).values({
        postId: post.id,
        profileId: input.targetProfileId,
      });

      return post;
    });
  } catch (error) {
    logger.error('Error creating post on profile', { error });
    throw error;
  }
};
