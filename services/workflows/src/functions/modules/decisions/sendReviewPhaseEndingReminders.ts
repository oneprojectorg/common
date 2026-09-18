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

export const REMINDER_DAYS_BEFORE_END = 3;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const FAN_OUT_CHUNK = 500;

export const sendReviewPhaseEndingReminders = inngest.createFunction(
  {
    id: 'decisions-review-phase-ending-reminders',
    name: 'Send Review Phase Ending Reminders',
  },
  // 00:30, not 00:00: processTransitions runs at midnight and sweeping in the
  // same minute races the advance that makes the phase current.
  { cron: '30 0 * * *' },
  async ({ step }) => {
    const transitions = await step.run(
      'find-ending-review-phases',
      async () => {
        // Exclusive lower bound, measured from UTC midnight, so consecutive
        // daily buckets tile without re-sending.
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
              reminderWindowEnd: windowEnd,
            },
          ];
        });
      },
    );

    if (transitions.length === 0) {
      return { remindersQueued: 0 };
    }

    for (let offset = 0; offset < transitions.length; offset += FAN_OUT_CHUNK) {
      await step.sendEvent(
        `fan-out-reminders-${offset / FAN_OUT_CHUNK}`,
        transitions.slice(offset, offset + FAN_OUT_CHUNK).map((transition) => ({
          name: reviewPhaseEndingSoon.name,
          data: transition,
        })),
      );
    }

    return { remindersQueued: transitions.length };
  },
);
