import { listProcessParticipants, listProfileRecipients } from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { EntityType, posts, processInstances, profiles } from '@op/db/schema';
import { DecisionUpdateNotificationEmail, OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const key = 'event.data.authorProfileId + "-" + event.data.targetProfileId';
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
  async ({ event, step, runId }) => {
    const { postId, targetProfileId } = decisionUpdatePosted.schema.parse(
      event.data,
    );

    const [post, target] = await Promise.all([
      step.run('get-post', async () => {
        const [row] = await db
          .select({
            authorProfileId: profiles.id,
            authorName: profiles.name,
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
            processInstanceId: processInstances.id,
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
    ]);

    if (target?.profileType !== EntityType.DECISION) {
      return;
    }

    const { processProfileSlug, processInstanceId, processTitle } = target;
    if (!processProfileSlug || !processInstanceId || !processTitle) {
      return;
    }

    if (!post) {
      logger.error('No post found for update notification', {
        postId,
        targetProfileId,
      });
      return;
    }

    // Process-profile members alone miss public submitters, who are the
    // majority of an open process — same audience as phase transitions.
    const [participants, author] = await Promise.all([
      step.run('get-participants', async () =>
        listProcessParticipants({ processInstanceId }),
      ),
      step.run('get-author', async () =>
        listProfileRecipients({ profileId: post.authorProfileId }),
      ),
    ]);

    // Excluded by identity: the participant list is keyed on authUserId, and
    // comparing a profile's contact address against a sign-in address used to
    // mail the author their own update whenever the two differed.
    const authorAuthUserIds = new Set(
      author.map(({ authUserId }) => authUserId),
    );
    const recipients = selectEmailRecipients(
      participants.filter(
        ({ authUserId }) => !authorAuthUserIds.has(authUserId),
      ),
    );

    if (recipients.length === 0) {
      logger.warn('No participants to notify for decision update', {
        postId,
        targetProfileId,
      });
      return;
    }

    const updateUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfileSlug}?panel=updates`;
    const authorName = post.authorName ?? 'A Common user';

    const result = await step.run('send-emails', async () => {
      const emails = recipients.map((email) => ({
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

      const { errors } = await OPBatchSend(emails, {
        // Stable across retries, unique per run: a retry replays delivered
        // chunks instead of re-sending them.
        idempotencyKeyPrefix: `decision-update/${runId}`,
      });

      // Throwing would make Inngest retry the step and re-blast everyone
      // whose batch already succeeded.
      if (errors.length > 0) {
        logger.error('Some decision update notifications failed to send', {
          postId,
          targetProfileId,
          failedCount: errors.length,
        });
      }

      logger.info('Decision update notifications sent', {
        postId,
        targetProfileId,
        sent: emails.length - errors.length,
        idempotencyKeyPrefix: `decision-update/${runId}`,
      });
      // Not `data.length` — under Resend that counts 100-email batches.
      return {
        sent: emails.length - errors.length,
        failed: errors.length,
      };
    });

    return {
      message: `${result.sent} decision update notification(s) sent, ${result.failed} failed`,
    };
  },
);
