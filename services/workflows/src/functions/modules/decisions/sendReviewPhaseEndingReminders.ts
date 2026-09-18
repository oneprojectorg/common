import { getInstancePhases } from '@op/common';
import { db } from '@op/db/client';
import { ProcessStatus, processInstances } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

const { reviewPhaseEndingSoon } = Events;

const REMINDER_DAYS_BEFORE_END = 3;

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
    const reminders = await step.run('find-ending-review-phases', async () => {
      // Exclusive lower bound, measured from UTC midnight, so consecutive
      // daily buckets tile without re-sending.
      const midnightUtc = new Date().setUTCHours(0, 0, 0, 0);
      const windowStart =
        midnightUtc + (REMINDER_DAYS_BEFORE_END - 1) * MS_PER_DAY;
      const windowEnd = midnightUtc + REMINDER_DAYS_BEFORE_END * MS_PER_DAY;
      const reminderWindowEnd = new Date(windowEnd).toISOString();

      const rows = await db
        .select({
          id: processInstances.id,
          currentStateId: processInstances.currentStateId,
          instanceData: processInstances.instanceData,
        })
        .from(processInstances)
        .where(
          and(
            eq(processInstances.status, ProcessStatus.PUBLISHED),
            isNull(processInstances.deletedAt),
            isNotNull(processInstances.currentStateId),
          ),
        );

      return rows.flatMap((row) => {
        const phaseId = row.currentStateId;

        if (!phaseId) {
          return [];
        }

        const phase = getInstancePhases(row.instanceData).find(
          (p) => p.phaseId === phaseId,
        );

        // Not isReviewPhase: it falls back to the legacy
        // `rules.proposals.review` flag, which this reminder skips.
        if (phase?.rules?.reviews?.submit !== true || !phase.endDate) {
          return [];
        }

        const endDate = new Date(phase.endDate).getTime();

        if (
          Number.isNaN(endDate) ||
          endDate <= windowStart ||
          endDate > windowEnd
        ) {
          return [];
        }

        return [{ processInstanceId: row.id, phaseId, reminderWindowEnd }];
      });
    });

    if (reminders.length === 0) {
      return { remindersQueued: 0 };
    }

    for (let offset = 0; offset < reminders.length; offset += FAN_OUT_CHUNK) {
      await step.sendEvent(
        `fan-out-reminders-${offset / FAN_OUT_CHUNK}`,
        reminders.slice(offset, offset + FAN_OUT_CHUNK).map((reminder) => ({
          name: reviewPhaseEndingSoon.name,
          data: reminder,
        })),
      );
    }

    return { remindersQueued: reminders.length };
  },
);
