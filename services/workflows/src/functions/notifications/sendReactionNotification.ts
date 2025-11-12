import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  organizations,
  postReactions,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { REACTION_OPTIONS } from '@op/types';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const key = 'event.data.company_id';
const { postReactionAdded } = Events;

export const sendReactionNotification = inngest.createFunction(
  {
    id: 'sendReactionNotification',
    debounce: {
      key,
      period: '2m',
      timeout: '5m',
    },
  },
  { event: postReactionAdded.name },
  async ({ event, step }) => {
    // Validate event data with Zod schema for runtime type safety
    const { sourceProfileId, postId, reactionType } =
      postReactionAdded.schema.parse(event.data);

    const reactionEmoji = REACTION_OPTIONS.find(
      (option) => option.key === reactionType,
    );

    if (!reactionEmoji) {
      console.log('Invalid reaction type:', reactionType);
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

            orgProfileSlug: orgProfile.slug,
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
          console.log('No data found for post reaction notification');
          return;
        }

        if (!data.orgProfileSlug) {
          console.log(
            'Could not find profile slug for post reaction notification',
            postId,
          );
          return;
        }

        // Determine author profile: org profile takes precedence if post has no profileId
        const authorProfile = data.postProfileId
          ? { name: data.postAuthorName!, email: data.postAuthorEmail! }
          : { name: data.orgProfileName!, email: data.orgProfileEmail! };

        if (!authorProfile?.email) {
          console.log('No author email found for post reaction notification');
          return;
        }

        const contextName = data.parentPostContent || data.postContent;

        const reactorName = data.sourceProfileName;
        const contentType = data.parentPostId ? 'comment' : 'post';
        const { OPNodemailer } = await import('@op/emails');
        const { ReactionNotificationEmail } = await import('@op/emails');
        const postUrl = `${OPURLConfig('APP').ENV_URL}/profile/${data.orgProfileSlug}/posts/${postId}`;

        console.log('Sending post react notification email', {
          sourceProfileId,
          postId,
          contextName,
        });

        await OPNodemailer({
          to: authorProfile.email,
          from: `${reactorName} via Common`,
          subject: `${reactorName} reacted to your ${contentType}`,
          component: () =>
            ReactionNotificationEmail({
              reactorName,
              postContent: data.postContent,
              recipientName: authorProfile.name,
              reactionType: reactionEmoji.emoji,
              contentType,
              postUrl,
              contextName,
            }),
        });
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
