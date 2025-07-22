import { db } from '@op/db/client';
import { comments, commentsToPost, profiles, objectsInStorage } from '@op/db/schema';
import type { GetCommentsInput } from '@op/types';
import { desc, eq } from 'drizzle-orm';

export const getComments = async (input: GetCommentsInput) => {
  try {
    let commentsData;

    if (input.commentableType === 'post') {
      // Query comments for posts via join table with profile information
      commentsData = await db
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
        .innerJoin(commentsToPost, eq(comments.id, commentsToPost.commentId))
        .innerJoin(profiles, eq(comments.profileId, profiles.id))
        .leftJoin(objectsInStorage, eq(profiles.avatarImageId, objectsInStorage.id))
        .where(eq(commentsToPost.postId, input.commentableId))
        .orderBy(desc(comments.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    } else {
      throw new Error(`Unsupported commentable type: ${input.commentableType}`);
    }

    // Transform the flat result into the nested structure expected by the frontend
    const transformedComments = commentsData.map((row) => ({
      id: row.id,
      content: row.content,
      profileId: row.profileId,
      parentCommentId: row.parentCommentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      profile: {
        id: row.profileId_,
        type: row.profileType,
        name: row.profileName,
        slug: row.profileSlug,
        bio: row.profileBio,
        mission: row.profileMission,
        email: row.profileEmail,
        website: row.profileWebsite,
        city: row.profileCity,
        state: row.profileState,
        avatarImage: row.avatarImageId ? {
          id: row.avatarImageId,
          name: row.avatarImageName,
          metadata: row.avatarImageMetadata,
        } : null,
      },
    }));

    return transformedComments;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};