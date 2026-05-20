import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  EntityType,
  posts,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { DecisionUpdateNotificationEmail, OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';

const key =
  'event.data.authorProfileId + "-" + event.data.targetProfileId';
const { decisionUpdatePosted } = Events;

export const sendDecisionUpdateNotification = inngest.createFunction(
  {
    id: 'sendDecisionUpdateNotification',
    debounce: {
      key,
      period: '1m',
      timeout: '5m',
    },
  },
  { event: decisionUpdatePosted.name },
  async ({ event, step }) => {
    const { postId, targetProfileId } = decisionUpdatePosted.schema.parse(
      event.data,
    );

    const [post, target, participants] = await Promise.all([
      step.run('get-post', async () => {
        const [row] = await db
          .select({
            authorName: profiles.name,
            authorEmail: profiles.email,
            postContent: posts.content,
          })
          .from(posts)
          .innerJoin(profiles, eq(profiles.id, posts.profileId))
          .where(eq(posts.id, postId))
          .limit(1);
        return row ?? null;
      }),
      step.run('get-target', async () => {
        const [row] = await db
          .select({
            profileType: profiles.type,
            processProfileSlug: profiles.slug,
            processTitle: processInstances.name,
          })
          .from(profiles)
          .leftJoin(
            processInstances,
            eq(processInstances.profileId, profiles.id),
          )
          .where(eq(profiles.id, targetProfileId))
          .limit(1);
        return row ?? null;
      }),
      step.run('get-participants', async () => {
        return db
          .select({ email: profileUsers.email })
          .from(profileUsers)
          .where(eq(profileUsers.profileId, targetProfileId));
      }),
    ]);

    if (target?.profileType !== EntityType.DECISION) {
      return;
    }

    const { processProfileSlug, processTitle } = target;
    if (!processProfileSlug || !processTitle) {
      return;
    }

    if (!post) {
      console.error('No post found for update notification', {
        postId,
        targetProfileId,
      });
      return;
    }

    const recipients = participants.filter(
      ({ email }) => email !== post.authorEmail,
    );

    if (recipients.length === 0) {
      console.warn('No participants to notify for decision update', {
        postId,
        targetProfileId,
      });
      return;
    }

    const updateUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfileSlug}?panel=updates`;
    const authorName = post.authorName ?? 'A Common user';

    const result = await step.run('send-emails', async () => {
      const emails = recipients.map(({ email }) => ({
        to: email,
        subject: DecisionUpdateNotificationEmail.subject(
          authorName,
          processTitle,
        ),
        component: () =>
          DecisionUpdateNotificationEmail({
            authorName,
            processTitle,
            updateContent: post.postContent,
            updateUrl,
          }),
      }));

      const { data, errors } = await OPBatchSend(emails);

      if (errors.length > 0) {
        throw new Error(`Email batch failed: ${JSON.stringify(errors)}`);
      }

      return { sent: data.length };
    });

    return {
      message: `${result.sent} decision update notification(s) sent`,
    };
  },
);
