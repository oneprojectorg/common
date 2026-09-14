import { type DecisionInstanceData, isReviewPhase } from '@op/common';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
} from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';

const { reviewPhaseEndingSoon } = Events;

/** Days before a review phase's scheduled end that the reminder goes out. */
export const REMINDER_DAYS_BEFORE_END = 3;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Finds pending phase transitions whose review phase is ending soon and fans
 * out a `review/phase-ending-soon` event per transition. The notification
 * function re-reads state and emails each reviewer with incomplete
 * assignments.
 */
export const sendReviewPhaseEndingReminders = inngest.createFunction(
  {
    id: 'decisions-review-phase-ending-reminders',
    name: 'Send Review Phase Ending Reminders',
  },
  // Run every day at midnight, same grain as processTransitions — our tier of
  // Inngest only supports up to 7 days advance scheduling, so a daily sweep
  // is the right shape (not per-phase sleepUntil).
  { cron: '0 0 * * *' },
  async ({ step }) => {
    const endingTransitions = await step.run(
      'find-ending-review-phases',
      async () => {
        // One-day-wide bucket (N-1, N] days out: with no reminder ledger,
        // landing in it exactly once is the only thing stopping a re-send.
        // Measured from UTC midnight so consecutive buckets tile exactly —
        // run-clock edges leave gaps and overlaps of a few seconds.
        const midnightUtc = new Date().setUTCHours(0, 0, 0, 0);
        const windowStart = new Date(
          midnightUtc + (REMINDER_DAYS_BEFORE_END - 1) * MS_PER_DAY,
        ).toISOString();
        const windowEnd = new Date(
          midnightUtc + REMINDER_DAYS_BEFORE_END * MS_PER_DAY,
        ).toISOString();

        const rows = await db
          .select({
            id: decisionProcessTransitions.id,
            processInstanceId: decisionProcessTransitions.processInstanceId,
            fromStateId: decisionProcessTransitions.fromStateId,
            instanceData: processInstances.instanceData,
          })
          .from(decisionProcessTransitions)
          .innerJoin(
            processInstances,
            eq(
              decisionProcessTransitions.processInstanceId,
              processInstances.id,
            ),
          )
          .where(
            and(
              isNull(decisionProcessTransitions.completedAt),
              gt(decisionProcessTransitions.scheduledDate, windowStart),
              lte(decisionProcessTransitions.scheduledDate, windowEnd),
              eq(processInstances.status, ProcessStatus.PUBLISHED),
              // Only remind for the phase the instance is actually in.
              eq(
                decisionProcessTransitions.fromStateId,
                processInstances.currentStateId,
              ),
            ),
          );

        return rows.flatMap((row) => {
          if (!row.fromStateId) {
            return [];
          }

          const instanceData = row.instanceData as DecisionInstanceData;
          const phase = instanceData?.phases?.find(
            (p) => p.phaseId === row.fromStateId,
          );

          if (!phase || !isReviewPhase(phase)) {
            return [];
          }

          return [
            {
              transitionId: row.id,
              processInstanceId: row.processInstanceId,
              phaseId: row.fromStateId,
            },
          ];
        });
      },
    );

    if (endingTransitions.length === 0) {
      return { remindersQueued: 0 };
    }

    await step.sendEvent(
      'fan-out-reminders',
      endingTransitions.map((transition) => ({
        name: reviewPhaseEndingSoon.name,
        data: transition,
      })),
    );

    return { remindersQueued: endingTransitions.length };
  },
);
