import { getInstanceCurrentPhase, getInstancePhases } from '@op/common';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { sql } from 'drizzle-orm';

const { reviewPhaseEndingSoon } = Events;

const REMINDER_DAYS_BEFORE_END = 3;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

      const reviewPhaseInstances = await db.query.processInstances.findMany({
        where: {
          status: ProcessStatus.PUBLISHED,
          deletedAt: { isNull: true },
          currentStateId: { isNotNull: true },
          // Pre-filter only; the review-flag guard below stays the real test.
          RAW: (table) =>
            sql`(jsonb_typeof(${table.instanceData} -> 'phases') = 'array' AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(${table.instanceData} -> 'phases') AS p
              WHERE p ->> 'phaseId' = ${table.currentStateId}
                AND (p -> 'rules' -> 'reviews' ->> 'submit')::boolean IS TRUE
            ))`,
        },
        columns: {
          id: true,
          currentStateId: true,
          instanceData: true,
        },
      });

      return reviewPhaseInstances.flatMap((instance) => {
        const phase = getInstanceCurrentPhase({
          currentStateId: instance.currentStateId,
          instanceData: { phases: getInstancePhases(instance.instanceData) },
        });

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

        return [
          {
            processInstanceId: instance.id,
            phaseId: phase.phaseId,
            reminderWindowEnd,
          },
        ];
      });
    });

    if (reminders.length === 0) {
      return { remindersQueued: 0 };
    }

    await step.sendEvent(
      'fan-out-reminders',
      reminders.map((reminder) => ({
        name: reviewPhaseEndingSoon.name,
        data: reminder,
      })),
    );

    return { remindersQueued: reminders.length };
  },
);
