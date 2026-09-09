import { type DecisionInstanceData, isReviewPhase } from '@op/common';
import { hasEmail } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  decisionProcessTransitions,
  processInstances,
  profiles,
} from '@op/db/schema';
import { OPBatchSend, ReviewPhaseEndingReminderEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const { reviewPhaseEndingSoon } = Events;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const sendReviewPhaseEndingReminder = inngest.createFunction(
  {
    id: 'sendReviewPhaseEndingReminder',
    // The cron's one-day scheduling window is what prevents cross-day
    // repeats; these keys dedupe retries and double-fired events within a
    // single sweep.
    idempotency: 'event.data.transitionId',
    debounce: {
      key: 'event.data.transitionId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: reviewPhaseEndingSoon.name },
  async ({ event, step }) => {
    const { transitionId } = reviewPhaseEndingSoon.schema.parse(event.data);

    const transitionData = await step.run('get-transition-data', async () => {
      const rows = await db
        .select({
          fromStateId: decisionProcessTransitions.fromStateId,
          scheduledDate: decisionProcessTransitions.scheduledDate,
          completedAt: decisionProcessTransitions.completedAt,
          processInstanceId: processInstances.id,
          processName: processInstances.name,
          processStatus: processInstances.status,
          currentStateId: processInstances.currentStateId,
          instanceData: processInstances.instanceData,
          profileSlug: profiles.slug,
        })
        .from(decisionProcessTransitions)
        .innerJoin(
          processInstances,
          eq(decisionProcessTransitions.processInstanceId, processInstances.id),
        )
        .leftJoin(profiles, eq(processInstances.profileId, profiles.id))
        .where(eq(decisionProcessTransitions.id, transitionId))
        .limit(1);

      return rows[0];
    });

    if (!transitionData) {
      logger.error('No transition found for id', { transitionId });
      return;
    }

    // Re-verify current DB state before sending — the phase may have
    // advanced, been rescheduled, or the process unpublished since the cron
    // queued this event.
    const phaseId = transitionData.fromStateId;
    if (
      transitionData.completedAt !== null ||
      transitionData.processStatus !== ProcessStatus.PUBLISHED ||
      !phaseId ||
      transitionData.currentStateId !== phaseId
    ) {
      return {
        message: `Skipped: transition ${transitionId} is no longer pending for the current phase`,
      };
    }

    const instanceData = transitionData.instanceData as DecisionInstanceData;
    const phase = instanceData?.phases?.find((p) => p.phaseId === phaseId);

    if (!phase || !isReviewPhase(phase)) {
      return {
        message: `Skipped: phase ${phaseId} is not a review phase`,
      };
    }

    const msLeft =
      new Date(transitionData.scheduledDate).getTime() - Date.now();
    if (msLeft <= 0) {
      return {
        message: `Skipped: transition ${transitionId} is already due`,
      };
    }
    const daysLeft = Math.ceil(msLeft / MS_PER_DAY);

    if (!transitionData.profileSlug) {
      logger.error('No profile slug found for process instance', {
        processInstanceId: transitionData.processInstanceId,
      });
      return;
    }

    const assignments = await step.run(
      'get-incomplete-assignments',
      async () => {
        return db.query.proposalReviewAssignments.findMany({
          where: {
            processInstanceId: transitionData.processInstanceId,
            phaseId,
            status: { ne: ProposalReviewAssignmentStatus.COMPLETED },
          },
          with: {
            reviewer: {
              with: {
                profileUsers: {
                  where: { email: { isNotNull: true } },
                },
              },
            },
          },
        });
      },
    );

    if (assignments.length === 0) {
      return {
        message: `Skipped: no incomplete assignments for transition ${transitionId}`,
      };
    }

    // One reminder per reviewer, listing how many reviews they have left.
    const reviewerReminders = new Map<
      string,
      { emails: string[]; remainingCount: number }
    >();

    for (const assignment of assignments) {
      const existing = reviewerReminders.get(assignment.reviewerProfileId);
      if (existing) {
        existing.remainingCount++;
      } else {
        reviewerReminders.set(assignment.reviewerProfileId, {
          emails: assignment.reviewer.profileUsers
            .filter(hasEmail)
            .map(({ email }) => email),
          remainingCount: 1,
        });
      }
    }

    const processTitle = transitionData.processName;
    const phaseName = phase.name ?? phaseId;
    const reviewsUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${transitionData.profileSlug}/reviews`;

    const emails = Array.from(reviewerReminders.values()).flatMap(
      ({ emails: reviewerEmails, remainingCount }) =>
        reviewerEmails.map((email) => ({
          to: email,
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
    );

    if (emails.length === 0) {
      logger.warn('No reviewer emails found for review phase reminder', {
        transitionId,
        processInstanceId: transitionData.processInstanceId,
      });
      return;
    }

    const result = await step.run('send-emails', async () => {
      try {
        const { data, errors } = await OPBatchSend(emails);

        if (errors.length > 0) {
          throw Error(`Email batch failed: ${JSON.stringify(errors)}`);
        }

        return {
          sent: data.length,
        };
      } catch (error) {
        logger.error('Failed to send review phase ending reminders', {
          error,
          transitionId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} review phase ending reminder(s) sent`,
    };
  },
);
