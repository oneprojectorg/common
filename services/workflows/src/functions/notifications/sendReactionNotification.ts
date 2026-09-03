import {
  listOrganizationAdminRecipients,
  listProfileRecipients,
} from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  organizations,
  postReactions,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';
import { OPBatchSend, ReactionNotificationEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const key = 'event.data.sourceProfileId + "-" + event.data.postId';
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

    const postAuthorProfile = alias(profiles, 'post_author_profile');
    const orgProfile = alias(profiles, 'org_profile');
    const parentPost = alias(posts, 'parent_post');

    const data = await step.run('get-reaction-data', async () => {
      const [row] = await db
        .select({
          // Source profile (person who liked)
          sourceProfileName: profiles.name,

          postContent: posts.content,
          postProfileId: posts.profileId,
          parentPostId: posts.parentPostId,

          postAuthorName: postAuthorProfile.name,

          organizationId: organizations.id,
          orgProfileSlug: orgProfile.slug,
          orgProfileName: orgProfile.name,

          parentPostContent: parentPost.content,
        })
        .from(postReactions)
        .innerJoin(profiles, eq(postReactions.profileId, profiles.id))
        .innerJoin(posts, eq(postReactions.postId, posts.id))
        .leftJoin(postAuthorProfile, eq(posts.profileId, postAuthorProfile.id))
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

      return row ?? null;
    });

    if (!data) {
      logger.info('No data found for post reaction notification', {
        postId,
        sourceProfileId,
      });
      return;
    }

    if (!data.orgProfileSlug) {
      logger.info(
        'Could not find profile slug for post reaction notification',
        {
          postId,
          sourceProfileId,
        },
      );
      return;
    }

    // The post's own author when it has one, otherwise the org's admins: an
    // org-attached post with no author profile has no account behind it, and
    // the org's contact address is a public field rather than an inbox we may
    // deliver to.
    const audience = await step.run('get-recipients', async () => {
      if (data.postProfileId) {
        return {
          recipientName: data.postAuthorName,
          candidates: await listProfileRecipients({
            profileId: data.postProfileId,
          }),
        };
      }

      return {
        recipientName: data.orgProfileName,
        candidates: data.organizationId
          ? await listOrganizationAdminRecipients({
              organizationId: data.organizationId,
            })
          : [],
      };
    });

    const recipients = selectEmailRecipients(audience.candidates);

    if (recipients.length === 0) {
      logger.info('No author address found for post reaction notification', {
        postId,
        sourceProfileId,
      });
      return;
    }

    const content = data.parentPostContent || data.postContent;
    const reactorName = data.sourceProfileName;
    const contentType = data.parentPostId ? 'comment' : 'post';
    const postUrl = `${OPURLConfig('APP').ENV_URL}/profile/${data.orgProfileSlug}/posts/${postId}`;

    const result = await step.run('send-emails', async () => {
      try {
        const { errors } = await OPBatchSend(
          recipients.map((email) => ({
            to: email,
            from: `${reactorName} via Common`,
            subject: `${reactorName} liked your ${contentType}`,
            component: () =>
              ReactionNotificationEmail({
                reactorName,
                postContent: data.postContent,
                recipientName: audience.recipientName ?? undefined,
                contentType,
                postUrl,
                content,
              }),
          })),
        );

        if (errors.length > 0) {
          throw Error(`Email batch failed: ${JSON.stringify(errors)}`);
        }

        return { sent: recipients.length };
      } catch (error) {
        // Log error and re-throw for retries
        logger.error('Failed to send reaction notification', {
          error,
          sourceProfileId,
          postId,
          reactionType,
        });
        throw error;
      }
    });

    return { message: `${result.sent} reaction notification(s) sent` };
  },
);
