import {
  computeDaysLeft,
  getInstancePhases,
  listProfileRecipients,
} from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { ProcessStatus, ProposalReviewAssignmentStatus } from '@op/db/schema';
import { OPBatchSend, ReviewPhaseEndingReminderEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { reviewPhaseEndingSoon } = Events;

export const sendReviewPhaseEndingReminder = inngest.createFunction(
  {
    id: 'sendReviewPhaseEndingReminder',
    // Bucket-scoped: a deadline pushed into a later bucket must not look like
    // a duplicate of the earlier one.
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

      // daysLeft reads observedAt, not a live clock: a retry that re-rounded
      // it would 409 the already-delivered chunk on its Resend key.
      return { ...instance, observedAt: new Date().toISOString() };
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

    if (instanceData.currentStateId !== phaseId) {
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
    const phase = phases.find((p) => p.phaseId === phaseId);

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

    // Past this reminder's own bucket the end date belongs to a later one,
    // which sends its own reminder — this event must not send a second.
    if (endDate.getTime() > new Date(reminderWindowEnd).getTime()) {
      logger.info('Skipping review phase reminder: end date moved later', {
        processInstanceId,
        phaseId,
      });
      return;
    }

    const now = new Date(instanceData.observedAt);

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

    const daysLeft = computeDaysLeft({ phaseId, phases, now });

    if (!daysLeft) {
      logger.info('Skipping review phase reminder: no days left to report', {
        processInstanceId,
        phaseId,
      });
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

    const emails = await step.run('plan-reviewer-emails', async () => {
      const assignments = await db.query.proposalReviewAssignments.findMany({
        where: {
          processInstanceId,
          phaseId,
          // AWAITING_AUTHOR_REVISION is the author's turn, not the reviewer's.
          status: {
            in: [
              ProposalReviewAssignmentStatus.PENDING,
              ProposalReviewAssignmentStatus.IN_PROGRESS,
              ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
            ],
          },
        },
        columns: { reviewerProfileId: true },
        with: {
          reviewer: { columns: { id: true, type: true } },
        },
      });

      const remainingByReviewer = new Map<
        string,
        { reviewer: (typeof assignments)[number]['reviewer']; count: number }
      >();

      for (const assignment of assignments) {
        const existing = remainingByReviewer.get(assignment.reviewerProfileId);
        if (existing) {
          existing.count++;
        } else {
          remainingByReviewer.set(assignment.reviewerProfileId, {
            reviewer: assignment.reviewer,
            count: 1,
          });
        }
      }

      const planned: Array<{ to: string; remainingCount: number }> = [];
      const reviewerProfileIdsWithoutAddress: Array<string> = [];

      for (const { reviewer, count } of remainingByReviewer.values()) {
        const recipients = selectEmailRecipients(
          await listProfileRecipients(reviewer),
        );

        if (recipients.length === 0) {
          reviewerProfileIdsWithoutAddress.push(reviewer.id);
          continue;
        }

        for (const to of recipients) {
          planned.push({ to, remainingCount: count });
        }
      }

      if (reviewerProfileIdsWithoutAddress.length > 0) {
        logger.warn('Skipped reviewers with no delivery address', {
          processInstanceId,
          phaseId,
          reviewerProfileIds: reviewerProfileIdsWithoutAddress,
        });
      }

      return planned;
    });

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
