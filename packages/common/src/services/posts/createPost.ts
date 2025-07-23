import { db } from '@op/db/client';
import { posts, postsToOrganizations } from '@op/db/schema';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { getCurrentProfileId } from '../access';

export interface CreatePostInput {
  content: string;
  parentPostId?: string; // If provided, this becomes a comment/reply
  organizationId?: string; // For organization posts
}

export const createPost = async (input: CreatePostInput) => {
  const { content, parentPostId, organizationId } = input;
  const profileId = await getCurrentProfileId();

  try {
    // If parentPostId is provided, verify the parent post exists
    if (parentPostId) {
      const parentPost = await db
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.id, parentPostId))
        .limit(1);

      if (parentPost.length === 0) {
        throw new CommonError('Parent post not found');
      }
    }

    // Create the post
    const [newPost] = await db
      .insert(posts)
      .values({
        content,
        parentPostId: parentPostId || null,
        profileId,
      })
      .returning();

    // If organizationId is provided, create the organization association
    if (organizationId) {
      await db.insert(postsToOrganizations).values({
        postId: newPost.id,
        organizationId,
      });
    } else if (parentPostId) {
      // For comments (posts with parentPostId), inherit organization associations from parent post
      const parentOrganizations = await db
        .select({ organizationId: postsToOrganizations.organizationId })
        .from(postsToOrganizations)
        .where(eq(postsToOrganizations.postId, parentPostId));

      if (parentOrganizations.length > 0) {
        await db.insert(postsToOrganizations).values(
          parentOrganizations.map((org) => ({
            postId: newPost.id,
            organizationId: org.organizationId,
          })),
        );
      }
    }

    return {
      ...newPost,
      reactionCounts: {},
      userReactions: [],
      commentCount: 0,
    };
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};
