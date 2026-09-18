import { getInstancePhases } from '@op/common';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { Events, inngest } from '@op/events';

const { reviewPhaseEndingSoon } = Events;

const REMINDER_DAYS_BEFORE_END = 3;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const FAN_OUT_CHUNK = 500;

export const sendReviewPhaseEndingReminders = inngest.createFunction(
  {
    id: 'decisions-review-phase-ending-reminders',
    name: 'Send Review Phase Ending Reminders',
  },
  // 00:30, not 00:00: processTransitions runs at midnight and would race us.
  { cron: '30 0 * * *' },
  async ({ step }) => {
    const reminders = await step.run('find-ending-review-phases', async () => {
      // Exclusive lower bound so consecutive daily buckets tile without re-sending.
      const midnightUtc = new Date().setUTCHours(0, 0, 0, 0);
      const windowStart =
        midnightUtc + (REMINDER_DAYS_BEFORE_END - 1) * MS_PER_DAY;
      const windowEnd = midnightUtc + REMINDER_DAYS_BEFORE_END * MS_PER_DAY;
      const reminderWindowEnd = new Date(windowEnd).toISOString();

      const rows = await db.query.processInstances.findMany({
        where: {
          status: ProcessStatus.PUBLISHED,
          deletedAt: { isNull: true },
          currentStateId: { isNotNull: true },
        },
        columns: {
          id: true,
          currentStateId: true,
          instanceData: true,
        },
      });

      return rows.flatMap((row) => {
        const phaseId = row.currentStateId;

        if (!phaseId) {
          return [];
        }

        const phase = getInstancePhases(row.instanceData).find(
          (p) => p.phaseId === phaseId,
        );

        // Not isReviewPhase: this reminder skips the legacy `proposals.review` flag.
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
