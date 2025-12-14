import { db } from '@op/db/client';
import { posts, postsToProfiles } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import { getCurrentProfileId } from '../access';

export interface CreatePostOnProfileInput {
  content: string;
  targetProfileId: string; // The profile where the post will appear
  parentPostId?: string;
  authUserId: string; // User ID for authentication
}

export const createPostOnProfile = async (input: CreatePostOnProfileInput) => {
  const { authUserId } = input;

  const authorProfileId = await getCurrentProfileId(authUserId);

  try {
    // Create a post authored by the current user
    const [post] = await db
      .insert(posts)
      .values({
        content: input.content,
        profileId: authorProfileId, // Author of the post
        parentPostId: input.parentPostId || null,
      })
      .returning();

    if (!post) {
      throw new NotFoundError('Failed to create post');
    }

    // Link the post to the target profile so it appears there
    await db.insert(postsToProfiles).values({
      postId: post.id,
      profileId: input.targetProfileId,
    });

    return post;
  } catch (error) {
    console.error('Error creating post on profile:', error);
    throw error;
  }
};
