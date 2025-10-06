import { db } from '@op/db/client';
import { Organization, Post, PostToOrganization, Profile } from '@op/db/schema';
import { PostLikedEventSchema, inngest } from '@op/events';
import { REACTION_OPTIONS } from '@op/types';

import { PostReaction } from '../../../../db/schema/tables/postReactions.sql';

export const sendReactionNotification = inngest.createFunction(
  {
    id: 'sendReactionNotification',
    debounce: {
      key: `event.data.sourceProfileId + ' - ' + event.data.postId`,
      period: '1m',
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
        // Manually typed as drizzle doesn't handled join relations well
        const relationship = (await db.query.postReactions.findFirst({
          where: (table, { eq, and }) =>
            and(eq(table.postId, postId), eq(table.profileId, sourceProfileId)),
          with: {
            profile: {
              columns: {
                name: true,
              },
            },
            post: {
              with: {
                profile: true,
                parentPost: true,
              },
            },
          },
        })) as
          | (PostReaction & {
              profile: {
                name: string;
                email: string;
              };
              post: Post & {
                profile: Profile;
                parentPost: Post;
              };
            })
          | undefined;

        if (!relationship) {
          return;
        }

        const { profile: sourceProfile, post } = relationship;

        const likerName = sourceProfile.name;

        const { OPNodemailer } = await import('@op/emails');
        const { LikeNotificationEmail } = await import('@op/emails');
        // If parentPostId exists, this IS a comment (it has a parent)
        // If no parentPostId, this is a top-level post
        const contentType = post.parentPostId ? 'comment' : 'post';
        const { content, parentPost } = post;

        let authorProfile;

        if (!post.profileId) {
          // this is an org post
          const postToOrg = (await db.query.postsToOrganizations.findFirst({
            where: (table, { eq }) => eq(table.postId, post.id),
            with: {
              organization: {
                with: {
                  profile: true,
                },
              },
            },
          })) as PostToOrganization & {
            organization: Organization & {
              profile: Profile;
            };
          };

          const org = postToOrg?.organization;
          authorProfile = org.profile;
        } else {
          authorProfile = post.profile;
        }

        if (!authorProfile?.email) {
          return;
        }

        const contextName = parentPost?.content || content;

        console.log('Sending post react notification email', {
          sourceProfileId,
          postId,
          contextName,
        });

        // TODO: For merging, we will first disable this as need the proper designed one anyhow and want to test the workflow functionality:w
        await OPNodemailer({
          to: authorProfile.email,
          from: `${likerName} via Common`,
          subject: `${likerName} reacted to your ${contentType}`,
          component: () =>
            LikeNotificationEmail({
              likerName,
              postContent: content,
              recipientName: authorProfile.name,
              reactionType: reactionEmoji.emoji,
              contentType,
              // TODO: generate a post url
              // postUrl,
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
