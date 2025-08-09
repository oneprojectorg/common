import { db } from '@op/db/client';
import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import { CreatePostInput } from '@op/types';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { getCurrentProfileId } from '../access';

export const createPost = async (input: CreatePostInput) => {
  const { content, attachmentIds = [], parentPostId, organizationId } = input;
  const profileId = await getCurrentProfileId();

  try {
    // Get all storage objects that were attached to the post
    const allStorageObjects =
      attachmentIds.length > 0
        ? await db.query.objectsInStorage.findMany({
            where: (table, { inArray }) => inArray(table.id, attachmentIds),
          })
        : [];

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

    if (!newPost) {
      throw new CommonError('Failed to create post');
    }

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

    // Create attachment records if any attachments were uploaded
    if (allStorageObjects.length > 0) {
      const attachmentValues = allStorageObjects.map((storageObject) => ({
        postId: newPost.id,
        storageObjectId: storageObject.id,
        profileId,
        fileName:
          storageObject?.name
            ?.split('/')
            .slice(-1)[0]
            ?.split('_')
            .slice(1)
            .join('_') ?? '',
        mimeType: (storageObject.metadata as { mimetype: string }).mimetype,
      }));

      await db.insert(attachments).values(attachmentValues);
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
