import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { comments, commentsToPost } from '@op/db/schema';
import type { CreateCommentInput } from '@op/types';
import { waitUntil } from '@vercel/functions';

import { CommonError, NotFoundError } from '../../utils';
import { getCurrentProfileId } from '../access';
import { sendCommentNotificationEmail } from '../email';

const sendCommentNotification = async (
  postId: string,
  commentContent: string,
  commenterProfileId: string,
  commentableType: string,
) => {
  try {
    // Get post and author information
    const post = await db.query.posts.findFirst({
      where: (table, { eq }) => eq(table.id, postId),
      with: {
        profile: true,
      },
    });

    if (post && post.profileId) {
      const [commenterProfile, postAuthorUser] = post.profileId
        ? await Promise.all([
          db.query.profiles.findFirst({
            where: (table, { eq }) => eq(table.id, commenterProfileId),
          }),
          db.query.users.findFirst({
            where: (table, { eq }) => eq(table.profileId, post.profileId!),
          }),
        ])
        : [
          await db.query.profiles.findFirst({
            where: (table, { eq }) => eq(table.id, commenterProfileId),
          }),
          null,
        ];

      if (
        commenterProfile &&
        postAuthorUser &&
        postAuthorUser.email &&
        post.profile
      ) {
        // Don't send notification if user is commenting on their own post
        if (post.profileId !== commenterProfileId) {
          const postAuthorName = Array.isArray(post.profile)
            ? 'User'
            : post.profile.name || 'User';

          const contentType =
            commentableType === 'proposal' ? 'proposal' : 'post';

          // Generate appropriate URL based on content type
          const baseUrl = OPURLConfig('APP');
          const contentUrl =
            contentType === 'proposal'
              ? `${baseUrl}/proposals/${postId}`
              : `${baseUrl}/org/${post.profileId}`;

          // Create context name from post content (first 50 characters)
          const contextName =
            post.content.length > 50
              ? `${post.content.slice(0, 50).trim()}...`
              : post.content.trim();

          // Get organization/process name for "Posted in" field
          const postedIn = post.profile
            ? Array.isArray(post.profile)
              ? 'Organization'
              : post.profile.name || 'Organization'
            : undefined;

          await sendCommentNotificationEmail({
            to: postAuthorUser.email,
            commenterName: commenterProfile.name,
            postContent: post.content,
            commentContent: commentContent,
            postUrl: contentUrl,
            recipientName: postAuthorName,
            contentType,
            contextName,
            postedIn,
          });
        }
      }
    }
  } catch (emailError) {
    // Log email error but don't fail the comment creation
    console.error('Failed to send comment notification email:', emailError);
  }
};

export const createComment = async (
  input: CreateCommentInput & {
    authUserId: string;
  },
) => {
  const { authUserId } = input;

  const profileId = await getCurrentProfileId(authUserId);

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

      // Send notification email to post author (run async without blocking response)
      // TODO: replace with our message queue and remove the dependency on waitUntil
      waitUntil(
        (async () => {
          try {
            await sendCommentNotification(
              input.commentableId,
              comment.content,
              profileId,
              input.commentableType,
            );
          } catch (error) {
            // Log notification errors but don't fail the comment creation
            console.error('Failed to send comment notification email:', error);
          }
        })(),
      );
    } else {
      throw new CommonError(
        `Unsupported commentable type: ${input.commentableType}`,
      );
    }

    return comment;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};
