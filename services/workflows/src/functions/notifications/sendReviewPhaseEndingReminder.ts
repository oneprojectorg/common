import {
  computeDaysLeft,
  getInstanceCurrentPhase,
  getInstancePhases,
  isInstanceCurrentPhase,
  listIndividualProfileRecipientsByProfileId,
} from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import { OPBatchSend, ReviewPhaseEndingReminderEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';

const { reviewPhaseEndingSoon } = Events;

export const sendReviewPhaseEndingReminder = inngest.createFunction(
  {
    id: 'sendReviewPhaseEndingReminder',
    idempotency:
      'event.data.processInstanceId + "-" + event.data.phaseId + "-" + event.data.reminderWindowEnd',
  },
  { event: reviewPhaseEndingSoon.name },
  async ({ event, step, runId }) => {
    const { processInstanceId, phaseId, reminderWindowEnd } =
      reviewPhaseEndingSoon.schema.parse(event.data);

    const instanceData = await step.run('get-instance-data', async () => {
      const instance = await db.query.processInstances.findFirst({
        where: { id: processInstanceId },
        columns: {
          id: true,
          name: true,
          status: true,
          currentStateId: true,
          instanceData: true,
          deletedAt: true,
        },
        with: {
          profile: { columns: { slug: true } },
        },
      });

      if (!instance) {
        return undefined;
      }

      return instance;
    });

    if (!instanceData) {
      logger.info('No process instance found for review phase reminder', {
        processInstanceId,
      });
      return;
    }

    if (
      instanceData.status !== ProcessStatus.PUBLISHED ||
      instanceData.deletedAt !== null
    ) {
      logger.info('Skipping review phase reminder: instance is not published', {
        processInstanceId,
      });
      return;
    }

    if (!isInstanceCurrentPhase(instanceData, phaseId)) {
      logger.info(
        'Skipping review phase reminder: phase is no longer current',
        {
          processInstanceId,
          phaseId,
        },
      );
      return;
    }

    const phases = getInstancePhases(instanceData.instanceData);
    const phase = getInstanceCurrentPhase({
      currentStateId: instanceData.currentStateId,
      instanceData: { phases },
    });

    if (phase?.rules?.reviews?.submit !== true) {
      logger.info('Skipping review phase reminder: not a review phase', {
        processInstanceId,
        phaseId,
      });
      return;
    }

    const endDate = phase.endDate ? new Date(phase.endDate) : undefined;

    if (!endDate || Number.isNaN(endDate.getTime())) {
      logger.info('Skipping review phase reminder: phase has no end date', {
        processInstanceId,
        phaseId,
      });
      return;
    }

    if (endDate.getTime() > new Date(reminderWindowEnd).getTime()) {
      logger.info('Skipping review phase reminder: end date moved later', {
        processInstanceId,
        phaseId,
      });
      return;
    }

    const now = new Date();

    if (endDate.getTime() <= now.getTime()) {
      logger.info(
        'Skipping review phase reminder: phase is already past its end',
        {
          processInstanceId,
          phaseId,
        },
      );
      return;
    }

    const profileSlug = instanceData.profile?.slug;

    if (!profileSlug) {
      logger.error('No profile slug found for process instance', {
        processInstanceId,
      });
      return;
    }

    const processTitle = instanceData.name;
    const phaseName = phase.name || phaseId;
    const reviewsUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${profileSlug}/current`;

    const plan = await step.run('plan-reviewer-emails', async () => {
      // Computed inside the step so a retry renders the same email: the
      // Resend idempotency key rejects a retry whose payload differs.
      const daysLeft = computeDaysLeft({ phaseId, phases });

      const remainingByReviewer = await db
        .select({
          reviewerProfileId: proposalReviewAssignments.reviewerProfileId,
          remaining: count(),
        })
        .from(proposalReviewAssignments)
        .where(
          and(
            eq(proposalReviewAssignments.processInstanceId, processInstanceId),
            eq(proposalReviewAssignments.phaseId, phaseId),
            inArray(proposalReviewAssignments.status, [
              ProposalReviewAssignmentStatus.PENDING,
              ProposalReviewAssignmentStatus.IN_PROGRESS,
              ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
            ]),
            isNull(proposalReviewAssignments.deletedAt),
          ),
        )
        .groupBy(proposalReviewAssignments.reviewerProfileId);

      const recipientsByProfileId =
        await listIndividualProfileRecipientsByProfileId(
          remainingByReviewer.map(({ reviewerProfileId }) => reviewerProfileId),
        );

      const planned: Array<{ to: string; remainingCount: number }> = [];
      const reviewerProfileIdsWithoutAddress: Array<string> = [];

      for (const { reviewerProfileId, remaining } of remainingByReviewer) {
        const recipients = selectEmailRecipients(
          recipientsByProfileId.get(reviewerProfileId) ?? [],
        );

        if (recipients.length === 0) {
          reviewerProfileIdsWithoutAddress.push(reviewerProfileId);
          continue;
        }

        for (const to of recipients) {
          planned.push({ to, remainingCount: remaining });
        }
      }

      if (reviewerProfileIdsWithoutAddress.length > 0) {
        logger.warn('Skipped reviewers with no delivery address', {
          processInstanceId,
          phaseId,
          reviewerProfileIds: reviewerProfileIdsWithoutAddress,
        });
      }

      return { daysLeft, emails: planned };
    });

    if (!plan.daysLeft) {
      logger.info('Skipping review phase reminder: no days left to report', {
        processInstanceId,
        phaseId,
      });
      return;
    }

    const { daysLeft, emails } = plan;

    if (emails.length === 0) {
      return {
        message: `Skipped: no reviewers to remind for phase ${phaseId}`,
      };
    }

    const result = await step.run('send-emails', async () => {
      const { data, errors } = await OPBatchSend(
        emails.map(({ to, remainingCount }) => ({
          to,
          subject: ReviewPhaseEndingReminderEmail.subject(
            processTitle,
            daysLeft,
          ),
          component: () =>
            ReviewPhaseEndingReminderEmail({
              processTitle,
              phaseName,
              remainingCount,
              daysLeft,
              reviewsUrl,
            }),
        })),
        {
          idempotencyKeyPrefix: `review-phase-ending-reminder/${runId}`,
        },
      );

      if (errors.length > 0) {
        logger.error('Some review phase ending reminders failed to send', {
          processInstanceId,
          phaseId,
          failedCount: errors.length,
        });
        throw new Error(
          `Review phase ending reminder email batch failed for ${errors.length} recipient(s)`,
        );
      }

      return { sent: data.length };
    });

    return {
      message: `${result.sent} review phase ending reminder(s) sent`,
    };
  },
);
