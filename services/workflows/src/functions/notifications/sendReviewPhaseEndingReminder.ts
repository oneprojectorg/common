import {
  computeDaysLeft,
  getInstanceCurrentPhase,
  getInstancePhases,
  isInstanceCurrentPhase,
  resolvePhases,
} from '@op/common';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { reviewPhaseEndingSoon, reviewReminderRequested } = Events;

export const sendReviewPhaseEndingReminder = inngest.createFunction(
  {
    id: 'sendReviewPhaseEndingReminder',
    idempotency:
      'event.data.processInstanceId + "-" + event.data.phaseId + "-" + event.data.reminderWindowEnd',
  },
  { event: reviewPhaseEndingSoon.name },
  async ({ event, step }) => {
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
      });

      if (!instance) {
        return undefined;
      }

      return resolvePhases({ instance });
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

    const daysLeft = computeDaysLeft({ phaseId, phases, now });

    if (!daysLeft) {
      logger.info('Skipping review phase reminder: no days left to report', {
        processInstanceId,
        phaseId,
      });
      return;
    }

    const processTitle = instanceData.name;
    const phaseName = phase.name || phaseId;
    const daysLeftText = daysLeft === 1 ? '1 day' : `${daysLeft} days`;
    const batchId = `${processInstanceId}-${phaseId}-${reminderWindowEnd}`;

    await step.sendEvent('request-review-reminder', {
      name: reviewReminderRequested.name,
      data: {
        batchId,
        processInstanceId,
        phaseId,
        message: `Hi {{firstName}},\n\nThe ${phaseName} phase of ${processTitle} is planned to end in ${daysLeftText}. You still have {{proposalsLeft}} left to complete.`,
      },
    });

    return { batchId };
  },
);
