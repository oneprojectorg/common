import { OPURLConfig } from '@op/core';
import { db, eq } from '@op/db/client';
import { processInstances, profileUsers, profiles } from '@op/db/schema';
import { OPBatchSend, PhaseTransitionEmail } from '@op/emails';
import { Events, inngest } from '@op/events';

const { phaseTransitioned } = Events;

export const sendPhaseTransitionNotification = inngest.createFunction(
  {
    id: 'sendPhaseTransitionNotification',
    debounce: {
      key: 'event.data.processInstanceId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: phaseTransitioned.name },
  async ({ event, step }) => {
    const { processInstanceId, fromPhaseId, toPhaseId } =
      phaseTransitioned.schema.parse(event.data);

    // Step 1: Get process instance with its profile and instance data
    const processData = await step.run('get-process-data', async () => {
      const instance = await db
        .select({
          id: processInstances.id,
          name: processInstances.name,
          profileId: processInstances.profileId,
          instanceData: processInstances.instanceData,
          profileSlug: profiles.slug,
        })
        .from(processInstances)
        .innerJoin(profiles, eq(processInstances.profileId, profiles.id))
        .where(eq(processInstances.id, processInstanceId))
        .limit(1);

      return instance[0];
    });

    if (!processData) {
      console.log('No process instance found for id:', processInstanceId);
      return;
    }

    // Resolve phase names from instance data
    const instanceData = processData.instanceData as {
      phases?: Array<{ phaseId: string; name?: string }>;
    };
    const phases = instanceData?.phases ?? [];
    const fromPhaseName =
      phases.find((p) => p.phaseId === fromPhaseId)?.name ?? fromPhaseId;
    const toPhaseName =
      phases.find((p) => p.phaseId === toPhaseId)?.name ?? toPhaseId;

    // Step 2: Get all participant emails (profileUsers linked to the process's profile)
    const participants = await step.run('get-participants', async () => {
      if (!processData.profileId) {
        return [];
      }

      return db
        .select({
          email: profileUsers.email,
        })
        .from(profileUsers)
        .where(eq(profileUsers.profileId, processData.profileId));
    });

    if (participants.length === 0) {
      console.log(
        'No participants found for process instance:',
        processInstanceId,
      );
      return;
    }

    const processUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processData.profileSlug}`;

    // Step 3: Send notification emails to all participants
    const result = await step.run('send-emails', async () => {
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
    });

    return {
      message: `${result.sent} phase transition notification(s) sent`,
    };
  },
);
