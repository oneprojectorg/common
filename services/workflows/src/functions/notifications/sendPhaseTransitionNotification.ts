import {
  type DecisionInstanceData,
  resolveManualSelectionStatus,
} from '@op/common';
import { hasEmail } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { processInstances, profileUsers, profiles } from '@op/db/schema';
import { OPBatchSend, PhaseTransitionEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { and, eq, isNotNull } from 'drizzle-orm';

const { phaseTransitioned, manualSelectionsConfirmed } = Events;

export const sendPhaseTransitionNotification = inngest.createFunction(
  {
    id: 'sendPhaseTransitionNotification',
    // The midnight-UTC processTransitions cron fans this handler out per
    // active process; each run does an unbounded profileUsers scan and
    // batch-sends emails. Cap concurrent runs per process so a busy decision
    // cannot starve the shared apps/api DB pool during the burst.
    concurrency: {
      limit: 5,
      key: 'event.data.processInstanceId',
    },
    debounce: {
      key: 'event.data.processInstanceId + "-" + event.data.fromPhaseId + "-" + event.data.toPhaseId',
      period: '1m',
      timeout: '3m',
    },
  },
  [
    { event: phaseTransitioned.name },
    { event: manualSelectionsConfirmed.name },
  ],
  async ({ event, step }) => {
    const { processInstanceId, toPhaseId } = phaseTransitioned.schema.parse(
      event.data,
    );

    const processData = await step.run('get-process-data', async () => {
      const instance = await db
        .select({
          name: processInstances.name,
          profileId: processInstances.profileId,
          instanceData: processInstances.instanceData,
          currentStateId: processInstances.currentStateId,
          profileSlug: profiles.slug,
        })
        .from(processInstances)
        .leftJoin(profiles, eq(processInstances.profileId, profiles.id))
        .where(eq(processInstances.id, processInstanceId))
        .limit(1);

      return instance[0];
    });

    if (!processData) {
      logger.error('No process instance found for id', { processInstanceId });
      return;
    }

    if (!processData.profileId) {
      logger.error('Process instance has no associated profile', {
        processInstanceId,
      });
      return;
    }

    // Hold the email until the inbound transition is settled — when the
    // departing phase had no selection pipeline (or its pipeline produced
    // zero picks), participants would otherwise be notified of a phase
    // they can't act in yet. submitManualSelection re-fires the event when
    // the admin confirms.
    const manualSelectionStatus = await step.run(
      'check-manual-selection',
      async () =>
        resolveManualSelectionStatus({
          instance: {
            id: processInstanceId,
            instanceData: processData.instanceData,
            currentStateId: processData.currentStateId,
          },
        }),
    );

    if (!manualSelectionStatus.selectionsAreConfirmed) {
      return {
        message: `Skipped: selections not yet confirmed for instance ${processInstanceId}`,
      };
    }

    // Resolve phase name and position from instance data
    const instanceData = processData.instanceData as DecisionInstanceData;
    const phases = instanceData?.phases ?? [];
    const toPhaseIndex = phases.findIndex((p) => p.phaseId === toPhaseId);
    const toPhaseName = phases[toPhaseIndex]?.name ?? toPhaseId;
    const phaseNumber = toPhaseIndex !== -1 ? toPhaseIndex + 1 : 1;
    const totalPhases = phases.length;

    const participants = await step.run('get-participants', async () => {
      const rows = await db
        .select({
          email: profileUsers.email,
        })
        .from(profileUsers)
        .where(
          and(
            eq(profileUsers.profileId, processData.profileId!),
            isNotNull(profileUsers.email),
          ),
        );

      return rows.filter(hasEmail);
    });

    if (participants.length === 0) {
      logger.warn('No participants found for process instance', {
        processInstanceId,
        profileId: processData.profileId,
      });
      return;
    }

    const processUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processData.profileSlug}`;

    const result = await step.run('send-emails', async () => {
      try {
        const emails = participants.map(({ email }) => ({
          to: email,
          subject: PhaseTransitionEmail.subject(processData.name, toPhaseName),
          component: () =>
            PhaseTransitionEmail({
              processTitle: processData.name,
              toPhaseName,
              phaseNumber,
              totalPhases,
              processUrl,
            }),
        }));

        const { data, errors } = await OPBatchSend(emails);

        if (errors.length > 0) {
          throw Error(`Email batch failed: ${JSON.stringify(errors)}`);
        }

        return {
          sent: data.length,
        };
      } catch (error) {
        logger.error('Failed to send phase transition notifications', {
          error,
          processInstanceId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} phase transition notification(s) sent`,
    };
  },
);
