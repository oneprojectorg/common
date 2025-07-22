import { db } from '@op/db/client';
import { comments, commentsToPost, profiles, objectsInStorage } from '@op/db/schema';
import type { CreateCommentInput } from '@op/types';
import { eq } from 'drizzle-orm';

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

    // Fetch the complete comment with profile information
    const [completeComment] = await db
      .select({
        id: comments.id,
        content: comments.content,
        profileId: comments.profileId,
        parentCommentId: comments.parentCommentId,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        deletedAt: comments.deletedAt,
        profileId_: profiles.id,
        profileType: profiles.type,
        profileName: profiles.name,
        profileSlug: profiles.slug,
        profileBio: profiles.bio,
        profileMission: profiles.mission,
        profileEmail: profiles.email,
        profileWebsite: profiles.website,
        profileCity: profiles.city,
        profileState: profiles.state,
        avatarImageId: objectsInStorage.id,
        avatarImageName: objectsInStorage.name,
        avatarImageMetadata: objectsInStorage.metadata,
      })
      .from(comments)
      .innerJoin(profiles, eq(comments.profileId, profiles.id))
      .leftJoin(objectsInStorage, eq(profiles.avatarImageId, objectsInStorage.id))
      .where(eq(comments.id, comment.id));

    if (!completeComment) {
      throw new NotFoundError('Failed to fetch created comment with profile');
    }

    // Transform the flat result into the nested structure expected by the frontend
    const transformedComment = {
      id: completeComment.id,
      content: completeComment.content,
      profileId: completeComment.profileId,
      parentCommentId: completeComment.parentCommentId,
      createdAt: completeComment.createdAt,
      updatedAt: completeComment.updatedAt,
      deletedAt: completeComment.deletedAt,
      profile: {
        id: completeComment.profileId_,
        type: completeComment.profileType,
        name: completeComment.profileName,
        slug: completeComment.profileSlug,
        bio: completeComment.profileBio,
        mission: completeComment.profileMission,
        email: completeComment.profileEmail,
        website: completeComment.profileWebsite,
        city: completeComment.profileCity,
        state: completeComment.profileState,
        avatarImage: completeComment.avatarImageId ? {
          id: completeComment.avatarImageId,
          name: completeComment.avatarImageName,
          metadata: completeComment.avatarImageMetadata,
        } : null,
      },
    };

    return transformedComment;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};
