import { db } from '@op/db/client';
import { attachments, posts, postsToProfiles } from '@op/db/schema';
import { CreatePostInput } from '@op/types';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { getCurrentProfileId } from '../access';

export const createPost = async (input: CreatePostInput) => {
  const {
    content,
    attachmentIds = [],
    parentPostId,
    profileId: targetProfileId,
    authUserId,
  } = input;
  
  const profileId = await getCurrentProfileId(authUserId);

  try {
    const newPost = await db.transaction(async (tx) => {
      // Get all storage objects that were attached to the post (inside transaction)
      const allStorageObjects =
        attachmentIds.length > 0
          ? await tx.query.objectsInStorage.findMany({
              where: (table, { inArray }) => inArray(table.id, attachmentIds),
            })
          : [];

      // If parentPostId is provided, verify the parent post exists (inside transaction)
      if (parentPostId) {
        const parentPost = await tx
          .select({ id: posts.id })
          .from(posts)
          .where(eq(posts.id, parentPostId))
          .limit(1);

        if (parentPost.length === 0) {
          throw new CommonError('Parent post not found');
        }
      }
      // Create the post
      const [newPost] = await tx
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

      // If targetProfileId is provided, create the profile association
      if (targetProfileId) {
        await tx.insert(postsToProfiles).values({
          postId: newPost.id,
          profileId: targetProfileId,
        });
      } else if (parentPostId) {
        // For comments (posts with parentPostId), inherit profile associations from parent post
        const parentProfiles = await tx
          .select({ profileId: postsToProfiles.profileId })
          .from(postsToProfiles)
          .where(eq(postsToProfiles.postId, parentPostId));

        if (parentProfiles.length > 0) {
          await tx.insert(postsToProfiles).values(
            parentProfiles.map((profile) => ({
              postId: newPost.id,
              profileId: profile.profileId,
            })),
          );
        }
      } else {
        throw new CommonError('Failed to create post');
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

        await tx.insert(attachments).values(attachmentValues);
      }

      return newPost;
    });

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
