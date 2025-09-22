import { db } from '@op/db/client';
import { attachments, posts, postsToProfiles } from '@op/db/schema';
import { CreatePostInput } from '@op/types';
import { eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { getCurrentProfileId } from '../access';
import { sendCommentNotificationEmail } from '../email';

interface CreatePostServiceInput extends CreatePostInput {
  authUserId: string;
}

const sendPostCommentNotification = async (
  parentPostId: string,
  commentContent: string,
  commenterProfileId: string,
) => {
  try {
    // Get parent post and author information
    const parentPost = await db.query.posts.findFirst({
      where: (table, { eq }) => eq(table.id, parentPostId),
      with: {
        profile: true,
      },
    });

    if (parentPost && parentPost.profileId) {
      // Get commenter information
      const commenterProfile = await db.query.profiles.findFirst({
        where: (table, { eq }) => eq(table.id, commenterProfileId),
      });

      // Get parent post author's user information for email
      const postAuthorUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.profileId, parentPost.profileId!),
      });

      if (
        commenterProfile &&
        postAuthorUser &&
        postAuthorUser.email &&
        parentPost.profile
      ) {
        // Don't send notification if user is commenting on their own post
        if (parentPost.profileId !== commenterProfileId) {
          const postAuthorName = Array.isArray(parentPost.profile)
            ? 'User'
            : parentPost.profile.name || 'User';

          // For posts, we default to 'post' as the content type
          const contentType = 'post';

          // Generate appropriate URL - for posts, use org profile page
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || 'https://common.oneproject.org';
          const contentUrl = `${baseUrl}/org/${parentPost.profileId}`;

          await sendCommentNotificationEmail({
            to: postAuthorUser.email,
            commenterName: commenterProfile.name,
            postContent: parentPost.content,
            commentContent: commentContent,
            postUrl: contentUrl,
            recipientName: postAuthorName,
            contentType: contentType,
          });
        }
      }
    }
  } catch (emailError) {
    // Log email error but don't fail the post creation
    console.error(
      'Failed to send post comment notification email:',
      emailError,
    );
  }
};

const sendProposalCommentNotification = async (
  proposalId: string,
  commentContent: string,
  commenterProfileId: string,
) => {
  try {
    // Get proposal and author information
    const proposal = await db.query.proposals.findFirst({
      where: (table, { eq }) => eq(table.id, proposalId),
      with: {
        profile: true,
      },
    });

    if (proposal && proposal.profileId) {
      // Get commenter information
      const commenterProfile = await db.query.profiles.findFirst({
        where: (table, { eq }) => eq(table.id, commenterProfileId),
      });

      // Get proposal author's user information for email
      const proposalAuthorProfile = await db.query.profiles.findFirst({
        where: (table, { eq }) => eq(table.id, proposal.submittedByProfileId),
      });

      if (
        commenterProfile &&
        proposalAuthorProfile &&
        proposalAuthorProfile.email &&
        proposal.profile
      ) {
        // Don't send notification if user is commenting on their own proposal
        if (proposal.profileId !== commenterProfileId) {
          const proposalAuthorName = Array.isArray(proposal.profile)
            ? 'User'
            : proposal.profile.name || 'User';

          // For proposals, we use 'proposal' as the content type
          const contentType = 'proposal';

          // Generate appropriate URL - for proposals, use proposal view page
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || 'https://common.oneproject.org';
          const contentUrl = `${baseUrl}/proposals/${proposalId}`;

          // Extract proposal content from proposalData
          const proposalContent =
            typeof proposal.proposalData === 'object' &&
            proposal.proposalData !== null
              ? (proposal.proposalData as any)?.description ||
                (proposal.proposalData as any)?.title ||
                'Proposal content'
              : 'Proposal content';

          await sendCommentNotificationEmail({
            to: proposalAuthorProfile.email,
            commenterName: commenterProfile.name,
            postContent: proposalContent,
            commentContent: commentContent,
            postUrl: contentUrl,
            recipientName: proposalAuthorName,
            contentType: contentType,
          });
        }
      }
    }
  } catch (emailError) {
    // Log email error but don't fail the post creation
    console.error(
      'Failed to send proposal comment notification email:',
      emailError,
    );
  }
};

export const createPost = async (input: CreatePostServiceInput) => {
  const {
    content,
    attachmentIds = [],
    parentPostId,
    profileId: targetProfileId,
    proposalId,
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

    // Send notification email based on the type of comment
    if (parentPostId) {
      // This is a reply to an existing post/comment
      await sendPostCommentNotification(parentPostId, content, profileId);
    } else if (targetProfileId && proposalId) {
      // This is a comment on a proposal
      await sendProposalCommentNotification(proposalId, content, profileId);
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
