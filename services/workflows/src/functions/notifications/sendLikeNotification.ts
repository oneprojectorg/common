import { db } from '@op/db/client';
import { Organization, Post, PostToOrganization, Profile } from '@op/db/schema';
import { inngest } from '@op/events';
import { REACTION_OPTIONS } from '@op/types';

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
    const { data } = event as {
      data: { sourceProfileId: string; postId: string; reactionType: string };
    };
    const { sourceProfileId, postId, reactionType } = data;

    const reactionEmoji = REACTION_OPTIONS.find(
      (option) => option.key === reactionType,
    );

    if (!reactionEmoji) {
      return;
    }

    await step.run('send-email-notification', async () => {
      const relationship = await db.query.postReactions.findFirst({
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
      });

      if (!relationship) {
        return;
      }

      const { profile: sourceProfile, post } = relationship as unknown as {
        profile: {
          name: string;
          email: string;
        };
        post: Post & {
          profile: Profile;
          parentPost: Post;
        };
      };

      const likerName = sourceProfile.name;

      const { OPNodemailer } = await import('@op/emails');
      const { LikeNotificationEmail } = await import('@op/emails');
      const contentType = post.parentPostId ? 'post' : 'comment';
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

      console.log('Sending post react notification email', {
        to: authorProfile.email,
        from: `${likerName} via Common`,
        subject: `${likerName} commented on your ${contentType}`,
        likerName,
        recipientName: authorProfile.name,
        contextName: parentPost.content,
      });

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
            // postUrl,
            contextName: parentPost.content,
          }),
      });
    });

    return { message: `Notification email sent: ${event.data.email}!` };
  },
);
