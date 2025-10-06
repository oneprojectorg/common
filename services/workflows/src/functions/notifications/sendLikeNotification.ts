import { db } from '@op/db/client';
import {
  organizations,
  postReactions,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';
import { PostLikedEventSchema, inngest } from '@op/events';
import { REACTION_OPTIONS } from '@op/types';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const key = 'event.data.company_id';

export const sendReactionNotification = inngest.createFunction(
  {
    id: 'sendReactionNotification',
    debounce: {
      key,
      period: '2m',
      timeout: '5m',
    },
  },
  { event: 'post/liked' },
  async ({ event, step }) => {
    // Validate event data with Zod schema for type safety
    const validatedEvent = PostLikedEventSchema.parse(event);
    const { sourceProfileId, postId, reactionType } = validatedEvent.data;

    const reactionEmoji = REACTION_OPTIONS.find(
      (option) => option.key === reactionType,
    );

    if (!reactionEmoji) {
      return;
    }

    await step.run('send-email-notification', async () => {
      try {
        const postAuthorProfile = alias(profiles, 'post_author_profile');
        const orgProfile = alias(profiles, 'org_profile');
        const parentPost = alias(posts, 'parent_post');

        const result = await db
          .select({
            reactionType: postReactions.reactionType,

            // Source profile (person who reacted)
            sourceProfileName: profiles.name,

            postContent: posts.content,
            postProfileId: posts.profileId,
            parentPostId: posts.parentPostId,

            postAuthorName: postAuthorProfile.name,
            postAuthorEmail: postAuthorProfile.email,

            orgProfileName: orgProfile.name,
            orgProfileEmail: orgProfile.email,

            parentPostContent: parentPost.content,
          })
          .from(postReactions)
          .innerJoin(profiles, eq(postReactions.profileId, profiles.id))
          .innerJoin(posts, eq(postReactions.postId, posts.id))
          .leftJoin(
            postAuthorProfile,
            eq(posts.profileId, postAuthorProfile.id),
          )
          .leftJoin(
            postsToOrganizations,
            eq(posts.id, postsToOrganizations.postId),
          )
          .leftJoin(
            organizations,
            eq(postsToOrganizations.organizationId, organizations.id),
          )
          .leftJoin(orgProfile, eq(organizations.profileId, orgProfile.id))
          .leftJoin(parentPost, eq(posts.parentPostId, parentPost.id))
          .where(
            and(
              eq(postReactions.postId, postId),
              eq(postReactions.profileId, sourceProfileId),
            ),
          )
          .limit(1);

        const data = result[0];

        if (!data) {
          return;
        }

        // Determine author profile: org profile takes precedence if post has no profileId
        const authorProfile = data.postProfileId
          ? { name: data.postAuthorName!, email: data.postAuthorEmail! }
          : { name: data.orgProfileName!, email: data.orgProfileEmail! };

        if (!authorProfile?.email) {
          return;
        }

        const contextName = data.parentPostContent || data.postContent;

        // const likerName = data.sourceProfileName;
        // const contentType = data.parentPostId ? 'comment' : 'post';
        // const { OPNodemailer } = await import('@op/emails');
        // const { LikeNotificationEmail } = await import('@op/emails');

        console.log('Sending post react notification email', {
          sourceProfileId,
          postId,
          contextName,
        });

        // TODO: For merging, we will first disable this as need the proper designed one anyhow and want to test the workflow functionality:w
        // await OPNodemailer({
        // to: authorProfile.email,
        // from: `${likerName} via Common`,
        // subject: `${likerName} reacted to your ${contentType}`,
        // component: () =>
        // LikeNotificationEmail({
        // likerName,
        // postContent: data.postContent,
        // recipientName: authorProfile.name,
        // reactionType: reactionEmoji.emoji,
        // contentType,
        // // TODO: generate a post url
        // // postUrl,
        // contextName,
        // }),
        // });
      } catch (error) {
        // Log error and re-throw for retries
        console.error('Failed to send reaction notification:', {
          error,
          sourceProfileId,
          postId,
          reactionType,
        });
        throw error;
      }
    });

    return { message: 'Notification email sent successfully!' };
  },
);
