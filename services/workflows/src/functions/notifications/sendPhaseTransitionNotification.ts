import type { DecisionInstanceData } from '@op/common';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { processInstances, profileUsers, profiles } from '@op/db/schema';
import { OPBatchSend, PhaseTransitionEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';

const { phaseTransitioned } = Events;

export const sendPhaseTransitionNotification = inngest.createFunction(
  {
    id: 'sendPhaseTransitionNotification',
    debounce: {
      key: 'event.data.processInstanceId + "-" + event.data.fromPhaseId + "-" + event.data.toPhaseId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: phaseTransitioned.name },
  async ({ event, step }) => {
    const { processInstanceId, fromPhaseId, toPhaseId } =
      phaseTransitioned.schema.parse(event.data);

    const processData = await step.run('get-process-data', async () => {
      const instance = await db
        .select({
          name: processInstances.name,
          profileId: processInstances.profileId,
          instanceData: processInstances.instanceData,
          profileSlug: profiles.slug,
        })
        .from(processInstances)
        .leftJoin(profiles, eq(processInstances.profileId, profiles.id))
        .where(eq(processInstances.id, processInstanceId))
        .limit(1);

      return instance[0];
    });

    if (!processData) {
      console.error('No process instance found for id:', processInstanceId);
      return;
    }

    if (!processData.profileId) {
      console.error(
        'Process instance has no associated profile:',
        processInstanceId,
      );
      return;
    }

    // Resolve phase names from instance data
    const instanceData = processData.instanceData as DecisionInstanceData;
    const phases = instanceData?.phases ?? [];
    const fromPhaseName =
      phases.find((p) => p.phaseId === fromPhaseId)?.name ?? fromPhaseId;
    const toPhaseName =
      phases.find((p) => p.phaseId === toPhaseId)?.name ?? toPhaseId;

    const participants = await step.run('get-participants', async () => {
      return db
        .select({
          email: profileUsers.email,
        })
        .from(profileUsers)
        .where(eq(profileUsers.profileId, processData.profileId!));
    });

    if (participants.length === 0) {
      console.warn(
        'No participants found for process instance:',
        processInstanceId,
        'profileId:',
        processData.profileId,
      );
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
              fromPhaseName,
              toPhaseName,
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
        console.error('Failed to send phase transition notifications:', {
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
