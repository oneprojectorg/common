import {
  getReviewerFirstName,
  listIndividualProfileRecipientsByProfileId,
  listReviewersWithOpenAssignments,
  renderReviewReminderMessage,
} from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { ReviewReminderEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { sendNotificationEmails } from './sendNotificationEmails';

const { reviewReminderRequested } = Events;

export const sendReviewReminder = inngest.createFunction(
  {
    id: 'sendReviewReminder',
    idempotency: 'event.data.batchId',
  },
  { event: reviewReminderRequested.name },
  async ({ event, step, runId }) => {
    const { batchId, processInstanceId, phaseId, reviewerProfileIds, message } =
      reviewReminderRequested.schema.parse(event.data);

    const instanceData = await step.run('get-instance-data', async () => {
      const instance = await db.query.processInstances.findFirst({
        where: { id: processInstanceId },
        columns: { name: true, status: true, deletedAt: true },
        with: {
          profile: { columns: { slug: true } },
          steward: { columns: { name: true } },
        },
      });

      return instance ?? undefined;
    });

    if (!instanceData) {
      logger.info('No process instance found for review reminder', {
        batchId,
        processInstanceId,
      });
      return;
    }

    if (
      instanceData.status !== ProcessStatus.PUBLISHED ||
      instanceData.deletedAt !== null
    ) {
      logger.info('Skipping review reminder: instance is not published', {
        batchId,
        processInstanceId,
      });
      return;
    }

    const profileSlug = instanceData.profile?.slug;

    if (!profileSlug) {
      logger.error('No profile slug found for process instance', {
        batchId,
        processInstanceId,
      });
      return;
    }

    const processTitle = instanceData.name;
    const stewardName = instanceData.steward?.name.trim();
    const reviewsUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${profileSlug}/current`;

    const plan = await step.run('plan-reviewer-emails', async () => {
      // Only reviewers with open assignments in this instance and phase come
      // back, so a foreign or finished reviewer gets no email.
      const reviewers = await listReviewersWithOpenAssignments({
        processInstanceId,
        phaseId,
        reviewerProfileIds,
      });

      const openProfileIds = reviewers.map(
        ({ reviewerProfileId }) => reviewerProfileId,
      );
      const [reviewerProfiles, recipientsByProfileId] = await Promise.all([
        openProfileIds.length === 0
          ? []
          : db.query.profiles.findMany({
              where: { id: { in: openProfileIds } },
              columns: { id: true, name: true },
            }),
        listIndividualProfileRecipientsByProfileId(openProfileIds),
      ]);
      const nameByProfileId = new Map(
        reviewerProfiles.map(({ id, name }) => [id, name]),
      );

      const emails: Array<{
        to: string;
        firstName: string;
        remainingCount: number;
      }> = [];
      const reachedProfileIds = new Set<string>();

      for (const { reviewerProfileId, remainingCount } of reviewers) {
        const addresses = selectEmailRecipients(
          recipientsByProfileId.get(reviewerProfileId) ?? [],
        ).sort();

        if (addresses.length === 0) {
          continue;
        }

        reachedProfileIds.add(reviewerProfileId);
        const firstName = getReviewerFirstName(
          nameByProfileId.get(reviewerProfileId) ?? '',
        );

        for (const to of addresses) {
          emails.push({ to, firstName, remainingCount });
        }
      }
      const skippedProfileIds = (reviewerProfileIds ?? openProfileIds).filter(
        (reviewerProfileId) => !reachedProfileIds.has(reviewerProfileId),
      );

      if (skippedProfileIds.length > 0) {
        logger.warn('Skipped reviewers with no reminder', {
          batchId,
          processInstanceId,
          phaseId,
          reviewerProfileIds: skippedProfileIds,
        });
      }

      return { emails };
    });

    if (plan.emails.length === 0) {
      return { message: `Skipped: no reviewers to remind in batch ${batchId}` };
    }

    // Reads only memoized step output: a retry must send the same payload, or
    // Resend answers the reused idempotency key with a 409.
    const result = await step.run('send-emails', () =>
      sendNotificationEmails({
        emails: plan.emails.map(({ to, firstName, remainingCount }) => ({
          to,
          ...(stewardName ? { from: `${stewardName} via Common` } : {}),
          subject: ReviewReminderEmail.subject(processTitle),
          component: () =>
            ReviewReminderEmail({
              processTitle,
              message: renderReviewReminderMessage({
                template: message,
                firstName,
                remainingCount,
              }),
              reviewsUrl,
            }),
        })),
        failureMessage: 'review reminders',
        context: { batchId, processInstanceId, phaseId },
        idempotencyKeyPrefix: `review-reminder/${runId}`,
      }),
    );

    return { message: `${result.sent} review reminder(s) sent` };
  },
);
