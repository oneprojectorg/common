import {
  type DecisionInstanceData,
  isReviewPhase,
  listProfileRecipients,
} from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
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

import { REMINDER_DAYS_BEFORE_END } from '../modules/decisions/sendReviewPhaseEndingReminders';

const { reviewPhaseEndingSoon } = Events;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const sendReviewPhaseEndingReminder = inngest.createFunction(
  {
    id: 'sendReviewPhaseEndingReminder',
    // Cross-day repeats are the cron's job; this only dedupes retries and
    // double-fired events within one sweep.
    idempotency: 'event.data.transitionId',
  },
  { event: reviewPhaseEndingSoon.name },
  async ({ event, step, runId }) => {
    const { transitionId } = reviewPhaseEndingSoon.schema.parse(event.data);

    const transitionData = await step.run('get-transition-data', async () => {
      // Explicit join: decisionProcessTransitions has no relations-v2 entry.
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

      const row = rows[0];

      if (!row) {
        return undefined;
      }

      // daysLeft derives from observedAt, not a live clock: a retry that
      // re-rounded it would 409 the already-delivered chunk on its Resend key.
      return { ...row, observedAt: new Date().toISOString() };
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
      new Date(transitionData.scheduledDate).getTime() -
      new Date(transitionData.observedAt).getTime();
    if (msLeft <= 0) {
      return {
        message: `Skipped: transition ${transitionId} is already due`,
      };
    }

    // An admin can push the deadline out between the sweep and this run.
    if (msLeft > REMINDER_DAYS_BEFORE_END * MS_PER_DAY) {
      return {
        message: `Skipped: transition ${transitionId} is no longer ending soon`,
      };
    }

    const daysLeft = Math.ceil(msLeft / MS_PER_DAY);

    if (!transitionData.profileSlug) {
      logger.error('No profile slug found for process instance', {
        processInstanceId: transitionData.processInstanceId,
      });
      return;
    }

    const processTitle = transitionData.processName;
    const phaseName = phase.name ?? phaseId;
    const reviewsUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${transitionData.profileSlug}/reviews`;

    // Reading, grouping and address resolution share one step so the reviewer
    // profile types stay typed; a step boundary would widen them to plain
    // JSON strings.
    const emails = await step.run('plan-reviewer-emails', async () => {
      const assignments = await db.query.proposalReviewAssignments.findMany({
        where: {
          processInstanceId: transitionData.processInstanceId,
          phaseId,
          // Only what the reviewer can act on now: AWAITING_AUTHOR_REVISION
          // is the author's turn.
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

      // One reminder per reviewer, listing how many reviews they have left.
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
          transitionId,
          reviewerProfileIds: reviewerProfileIdsWithoutAddress,
        });
      }

      return planned;
    });

    if (emails.length === 0) {
      return {
        message: `Skipped: no reviewers to remind for transition ${transitionId}`,
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
          // Stable across retries, unique per run: a retry replays delivered
          // chunks and only the failed ones go out again.
          idempotencyKeyPrefix: `review-phase-ending-reminder/${runId}`,
        },
      );

      if (errors.length > 0) {
        logger.error('Some review phase ending reminders failed to send', {
          transitionId,
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
