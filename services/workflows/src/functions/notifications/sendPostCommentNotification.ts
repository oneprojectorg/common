import { listProfileRecipients } from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  organizations,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';
import { CommentNotificationEmail, OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';

const key = 'event.data.authorProfileId + "-" + event.data.parentPostId';
const { commentPosted } = Events;

export const sendPostCommentNotification = inngest.createFunction(
  {
    id: 'sendPostCommentNotification',
    debounce: {
      key,
      period: '1m',
      timeout: '5m',
    },
  },
  { event: commentPosted.name },
  async ({ event, step }) => {
    const { postId, parentPostId, authorProfileId } =
      commentPosted.schema.parse(event.data);

    // Resolve parent post + recipient (author of the parent) and the
    // commenter in parallel. The parent's content is what we render as
    // the email's "post" body; the comment's content is the new post.
    const [parent, commenter, comment, parentOrgLink] = await Promise.all([
      step.run('get-parent-post', async () => {
        const [row] = await db
          .select({
            postContent: posts.content,
            recipientId: profiles.id,
            recipientName: profiles.name,
            recipientSlug: profiles.slug,
          })
          .from(posts)
          .innerJoin(profiles, eq(profiles.id, posts.profileId))
          .where(eq(posts.id, parentPostId))
          .limit(1);
        return row ?? null;
      }),
      step.run('get-commenter', async () => {
        const [row] = await db
          .select({ name: profiles.name })
          .from(profiles)
          .where(eq(profiles.id, authorProfileId))
          .limit(1);
        return row ?? null;
      }),
      step.run('get-comment', async () => {
        const [row] = await db
          .select({ content: posts.content })
          .from(posts)
          .where(eq(posts.id, postId))
          .limit(1);
        return row ?? null;
      }),
      step.run('get-parent-org-link', async () => {
        const [row] = await db
          .select({
            orgProfileName: profiles.name,
            orgProfileSlug: profiles.slug,
          })
          .from(postsToOrganizations)
          .innerJoin(
            organizations,
            eq(organizations.id, postsToOrganizations.organizationId),
          )
          .innerJoin(profiles, eq(profiles.id, organizations.profileId))
          .where(eq(postsToOrganizations.postId, parentPostId))
          .limit(1);
        return row ?? null;
      }),
    ]);

    if (!parent || !commenter || !comment) {
      return;
    }

    // Don't notify the user about comments on their own post.
    if (parent.recipientId === authorProfileId) {
      return;
    }

    const recipients = await step.run('get-recipients', async () =>
      listProfileRecipients({ profileId: parent.recipientId }),
    );
    const [recipientEmail] = selectEmailRecipients(recipients);

    if (!recipientEmail) {
      return;
    }

    const contextName =
      parent.postContent.length > 50
        ? `${parent.postContent.slice(0, 50).trim()}...`
        : parent.postContent.trim();

    // Prefer org context for the URL/postedIn field when the parent post is
    // org-attached; otherwise fall back to the recipient (author) profile.
    const linkedProfileSlug =
      parentOrgLink?.orgProfileSlug ?? parent.recipientSlug;
    const postedIn = parentOrgLink?.orgProfileName ?? parent.recipientName;

    const baseUrl = OPURLConfig('APP').ENV_URL;
    const contentUrl = `${baseUrl}/profile/${linkedProfileSlug}/posts/${parentPostId}`;

    const result = await step.run('send-email', async () => {
      const { errors } = await OPBatchSend([
        {
          to: recipientEmail,
          from: `${commenter.name} via Common`,
          subject: CommentNotificationEmail.subject(commenter.name, 'post'),
          component: () =>
            CommentNotificationEmail({
              commenterName: commenter.name,
              postContent: parent.postContent,
              commentContent: comment.content,
              postUrl: contentUrl,
              recipientName: parent.recipientName,
              contentType: 'post',
              contextName,
              postedIn,
            }),
        },
      ]);

      if (errors.length > 0) {
        throw new Error(`Email send failed: ${JSON.stringify(errors)}`);
      }

      return { sent: 1 };
    });

    return {
      message: `${result.sent} post comment notification(s) sent`,
    };
  },
);
