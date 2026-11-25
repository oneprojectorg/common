import {
  fanOutNotifications,
  listProfileRecipients,
  listUndeliveredNotifications,
  recordNotificationDeliveries,
  recordProposalCommentActivity,
} from '@op/common';
import { OPURLConfig } from '@op/core';
import { CommentNotificationEmail, OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { clipCommentContext } from './commentContext';

const { proposalCommentPosted } = Events;

export const handleProposalCommentPosted = inngest.createFunction(
  { id: 'handleProposalCommentPosted' },
  { event: proposalCommentPosted.name },
  async ({ event, step, runId }) => {
    const { postId, proposalId, authorProfileId } =
      proposalCommentPosted.schema.parse(event.data);

    const idempotencyKey = event.id;
    if (!idempotencyKey) {
      logger.error('proposalComment/posted event has no id; skipping', {
        postId,
        proposalId,
      });
      return { message: 'Event has no id; skipped' };
    }

    const recorded = await step.run('record-activity', async () =>
      recordProposalCommentActivity({
        idempotencyKey,
        postId,
        proposalId,
        authorProfileId,
      }),
    );

    if (!recorded) {
      return { message: 'Comment context is gone; nothing recorded' };
    }

    const { activity, context } = recorded;

    if (
      !context.submittedBy ||
      context.submittedByProfileId === authorProfileId
    ) {
      return { message: 'Commenter is the proposal author; no notification' };
    }

    const submittedBy = context.submittedBy;
    const recipients = await step.run('get-recipients', async () =>
      listProfileRecipients(submittedBy),
    );

    if (recipients.length === 0) {
      return { message: 'No recipients' };
    }

    await step.run('fan-out', async () =>
      fanOutNotifications({
        activityId: activity.id,
        authUserIds: recipients.map(({ authUserId }) => authUserId),
        category: 'proposalsAndComments',
      }),
    );

    const result = await step.run('send-emails', async () => {
      const undelivered = await listUndeliveredNotifications({
        activityId: activity.id,
        channel: 'email',
      });

      const emailByUserId = new Map(
        recipients.map(({ authUserId, email }) => [authUserId, email]),
      );
      const sendable = undelivered.flatMap((notification) => {
        const email = emailByUserId.get(notification.authUserId);
        return email ? [{ notification, email }] : [];
      });

      if (sendable.length === 0) {
        return { sent: 0 };
      }

      if (!context.decisionSlug) {
        logger.error(
          'Cannot build proposal comment URL: proposal has no decision profile',
          { proposalId },
        );
        return { sent: 0 };
      }

      const baseUrl = OPURLConfig('APP').ENV_URL;
      const contentUrl = `${baseUrl}/decisions/${context.decisionSlug}/proposal/${context.proposalProfileId}`;
      const contextName = clipCommentContext(context.proposalTitle);

      const { data, errors } = await OPBatchSend(
        sendable.map(({ email }) => ({
          to: email,
          from: `${context.commenterName} via Common`,
          subject: CommentNotificationEmail.subject(
            context.commenterName,
            'proposal',
          ),
          component: () =>
            CommentNotificationEmail({
              commenterName: context.commenterName,
              postContent: context.proposalTitle,
              commentContent: context.commentContent,
              postUrl: contentUrl,
              recipientName: submittedBy.name ?? '',
              contentType: 'proposal',
              contextName,
              postedIn: context.processName,
            }),
        })),
        { idempotencyKeyPrefix: runId },
      );

      if (errors.length > 0) {
        throw new Error(`Email send failed: ${JSON.stringify(errors)}`);
      }

      await recordNotificationDeliveries(
        sendable.map(({ notification }, index) => ({
          notificationId: notification.id,
          channel: 'email',
          providerMessageId: data[index]?.id ?? null,
          status: 'sent',
        })),
      );

      return { sent: sendable.length };
    });

    return {
      message: `${result.sent} proposal comment notification(s) sent`,
    };
  },
);
