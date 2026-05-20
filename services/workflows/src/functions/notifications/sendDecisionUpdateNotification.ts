import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { posts, processInstances, profileUsers, profiles } from '@op/db/schema';
import { DecisionUpdateNotificationEmail, OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';

const { decisionUpdatePosted } = Events;

export const sendDecisionUpdateNotification = inngest.createFunction(
  {
    id: 'sendDecisionUpdateNotification',
  },
  { event: decisionUpdatePosted.name },
  async ({ event, step }) => {
    const { postId, processInstanceId } = decisionUpdatePosted.schema.parse(
      event.data,
    );

    const [post, processWithParticipants] = await Promise.all([
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
      step.run('get-process-participants', async () => {
        const [instance] = await db
          .select({
            processTitle: processInstances.name,
            processProfileId: processInstances.profileId,
            processProfileSlug: profiles.slug,
          })
          .from(processInstances)
          .leftJoin(profiles, eq(profiles.id, processInstances.profileId))
          .where(eq(processInstances.id, processInstanceId))
          .limit(1);

        if (!instance?.processProfileId || !instance.processProfileSlug) {
          return null;
        }

        const participants = await db
          .select({ email: profileUsers.email })
          .from(profileUsers)
          .where(eq(profileUsers.profileId, instance.processProfileId));

        return {
          processTitle: instance.processTitle,
          processProfileSlug: instance.processProfileSlug,
          participants,
        };
      }),
    ]);

    if (!post) {
      console.error('No post found for update notification', {
        postId,
        processInstanceId,
      });
      return;
    }

    if (!processWithParticipants) {
      console.error('Process instance has no associated profile/slug', {
        processInstanceId,
      });
      return;
    }

    const recipients = processWithParticipants.participants.filter(
      ({ email }) => email !== post.authorEmail,
    );

    if (recipients.length === 0) {
      console.warn('No participants to notify for decision update', {
        postId,
        processInstanceId,
      });
      return;
    }

    const updateUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processWithParticipants.processProfileSlug}?panel=updates`;
    const authorName = post.authorName ?? 'A Common user';

    const result = await step.run('send-emails', async () => {
      const emails = recipients.map(({ email }) => ({
        to: email,
        subject: DecisionUpdateNotificationEmail.subject(
          authorName,
          processWithParticipants.processTitle,
        ),
        component: () =>
          DecisionUpdateNotificationEmail({
            authorName,
            processTitle: processWithParticipants.processTitle,
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
