import { invalidate } from '@op/cache';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  Organization,
  Post,
  PostToOrganization,
  Profile,
  attachments,
  posts,
  postsToProfiles,
} from '@op/db/schema';
import { CreatePostInput } from '@op/types';
import { waitUntil } from '@vercel/functions';
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
    // Get parent post and author information, including organization associations
    const parentPostToOrg = (await db.query.postsToOrganizations.findFirst({
      where: (table, { eq }) => eq(table.postId, parentPostId),
      with: {
        organization: {
          with: {
            profile: true,
          },
        },
        post: true,
      },
    })) as PostToOrganization & {
      organization: Organization & { profile: Profile };
      post: Post;
    };

    const parentPost = parentPostToOrg.post;
    const parentProfile = parentPostToOrg.organization.profile;
    const parentProfileId = parentProfile.id;
    const parentProfileSlug = parentProfile.slug;

    if (parentProfileId) {
      // Parallelize commenter and post author queries
      const commenterProfile = await db.query.profiles.findFirst({
        where: (table, { eq }) => eq(table.id, commenterProfileId),
      });

      if (commenterProfile && parentProfile.email) {
        // Don't send notification if user is commenting on their own post
        if (parentProfileId !== commenterProfileId) {
          const postAuthorName = parentProfile.name;

          // For posts, we default to 'post' as the content type
          const contentType = 'post';

          // Create context name from post content (first 50 characters)
          const contextName =
            parentPost.content.length > 50
              ? `${parentPost.content.slice(0, 50).trim()}...`
              : parentPost.content.trim();

          // Generate URL using the organization profile ID instead of post author's profile
          const baseUrl = OPURLConfig('APP').ENV_URL;
          const contentUrl = `${baseUrl}/profile/${parentProfileSlug}/posts/${parentPost.id}`;

          await sendCommentNotificationEmail({
            to: parentProfile.email,
            commenterName: commenterProfile.name,
            postContent: parentPost.content,
            commentContent: commentContent,
            postUrl: contentUrl,
            recipientName: postAuthorName,
            contentType,
            contextName,
            postedIn: postAuthorName,
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
        processInstance: true,
      },
    });

    if (proposal && proposal.profileId) {
      // Parallelize commenter and proposal author queries
      const [commenterProfile, proposalAuthorProfile] = await Promise.all([
        db.query.profiles.findFirst({
          where: (table, { eq }) => eq(table.id, commenterProfileId),
        }),
        db.query.profiles.findFirst({
          where: (table, { eq }) => eq(table.id, proposal.submittedByProfileId),
        }),
      ]);

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

          const baseUrl = OPURLConfig('APP').ENV_URL;

          // Get processInstanceId for the URL
          const processInstanceId = proposal.processInstance
            ? (proposal.processInstance as any).id
            : 'unknown';

          // Get profile slug for the URL
          const profileSlug =
            proposal.profile && !Array.isArray(proposal.profile)
              ? proposal.profile.slug
              : 'unknown';

          const contentUrl = `${baseUrl}/profile/${profileSlug}/decisions/${processInstanceId}/proposal/${proposal.profileId}`;

          // Extract proposal content from proposalData
          const proposalContent =
            typeof proposal.proposalData === 'object' &&
            proposal.proposalData !== null
              ? (proposal.proposalData as any)?.description ||
                (proposal.proposalData as any)?.title ||
                'Proposal content'
              : 'Proposal content';

          // Create context name from proposal title (preferred) or description
          const proposalTitle =
            typeof proposal.proposalData === 'object' &&
            proposal.proposalData !== null
              ? (proposal.proposalData as any)?.title
              : null;

          const contextName = proposalTitle
            ? proposalTitle.length > 50
              ? `${proposalTitle.slice(0, 50).trim()}...`
              : proposalTitle.trim()
            : proposalContent.length > 50
              ? `${proposalContent.slice(0, 50).trim()}...`
              : proposalContent.trim();

          // Get decision-making process name for "Posted in" field
          let postedIn = 'Unknown Process';
          if (proposal.processInstance) {
            const processInstanceData = proposal.processInstance as any;
            postedIn = processInstanceData.name || 'Decision Making Process';
          }

          await sendCommentNotificationEmail({
            to: proposalAuthorProfile.email,
            commenterName: commenterProfile.name,
            postContent: proposalContent,
            commentContent: commentContent,
            postUrl: contentUrl,
            recipientName: proposalAuthorName,
            contentType: contentType,
            contextName: contextName,
            postedIn: postedIn,
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
    // TODO: Use the message queue for this and remove @vercel/functions as a dependency in @op/common
    waitUntil(
      (async () => {
        try {
          if (parentPostId) {
            // This is a reply to an existing post/comment
            await sendPostCommentNotification(parentPostId, content, profileId);
          } else if (targetProfileId && proposalId) {
            // This is a comment on a proposal
            await sendProposalCommentNotification(
              proposalId,
              content,
              profileId,
            );
          }
        } catch (error) {
          // Log notification errors but don't fail the post creation
          console.error('Failed to send notification email:', error);
        }
      })(),
    );

    // Invalidate cache for the target profile if this is a profile-associated post (like a proposal comment)
    if (targetProfileId) {
      await invalidate({
        type: 'profile',
        params: [targetProfileId],
      });
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
