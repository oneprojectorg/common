import {
  type DecisionInstanceData,
  listProcessParticipants,
  resolveManualSelectionStatus,
} from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { processInstances, profiles } from '@op/db/schema';
import { OPBatchSend, PhaseTransitionEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const { phaseTransitioned, manualSelectionsConfirmed } = Events;

export const sendPhaseTransitionNotification = inngest.createFunction(
  {
    id: 'sendPhaseTransitionNotification',
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
  async ({ event, step, runId }) => {
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

    // The Members panel alone misses public submitters, who are the majority
    // of an open process.
    const participants = await step.run('get-participants', async () =>
      listProcessParticipants({ processInstanceId }),
    );

    // The service is channel-agnostic, so address filtering is this sender's
    // own concern.
    const recipientEmails = selectEmailRecipients(participants);

    if (recipientEmails.length === 0) {
      logger.warn('No participants found for process instance', {
        processInstanceId,
        profileId: processData.profileId,
      });
      return;
    }

    const processUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processData.profileSlug}`;

    const result = await step.run('send-emails', async () => {
      try {
        const emails = recipientEmails.map((email) => ({
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

        const { errors } = await OPBatchSend(emails, {
          // Stable across retries, unique per run: a retry replays delivered
          // chunks and only the failed ones go out again.
          idempotencyKeyPrefix: `phase-transition/${runId}`,
        });

        if (errors.length > 0) {
          logger.error('Some phase transition notifications failed to send', {
            processInstanceId,
            failedCount: errors.length,
          });
          throw new Error(
            `Phase transition email batch failed for ${errors.length} recipient(s)`,
          );
        }

        logger.info('Phase transition notifications sent', {
          processInstanceId,
          toPhaseId,
          sent: emails.length,
          idempotencyKeyPrefix: `phase-transition/${runId}`,
        });
        return { sent: emails.length };
      } catch (error) {
        logger.error('Failed to send phase transition notifications', {
          error,
          processInstanceId,
        });
        throw error;
      }
    });

    return {
      sent: result.sent,
      message: `${result.sent} phase transition notification(s) sent`,
    };
  },
);
