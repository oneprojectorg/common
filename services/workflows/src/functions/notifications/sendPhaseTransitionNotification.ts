import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { processInstances, profileUsers, profiles } from '@op/db/schema';
import { PhaseTransitionEmail, OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';

import type { DecisionInstanceData } from '@op/common';

const { phaseTransitioned } = Events;

export const sendPhaseTransitionNotification = inngest.createFunction(
  { id: 'sendPhaseTransitionNotification' },
  { event: phaseTransitioned.name },
  async ({ event, step }) => {
    const { processInstanceId, toPhaseId } =
      phaseTransitioned.schema.parse(event.data);

    // Step 1: Get process instance and associated profile data
    const instanceData = await step.run('get-instance-data', async () => {
      const result = await db
        .select({
          profileId: processInstances.profileId,
          instanceData: processInstances.instanceData,
          profileName: profiles.name,
          profileSlug: profiles.slug,
        })
        .from(processInstances)
        .innerJoin(profiles, eq(processInstances.profileId, profiles.id))
        .where(eq(processInstances.id, processInstanceId))
        .limit(1);

      return result[0] ?? null;
    });

    if (!instanceData || !instanceData.profileId) {
      console.warn('No instance data found for process:', processInstanceId);
      return;
    }

    // Resolve the target phase name and optional description
    const phases =
      (instanceData.instanceData as DecisionInstanceData)?.phases ?? [];
    const targetPhase = phases.find((p) => p.phaseId === toPhaseId);
    const phaseName = targetPhase?.name ?? 'Next Phase';
    const phaseDescription =
      targetPhase?.headline ?? targetPhase?.description ?? null;

    // Step 2: Get all participants (profileUsers for the process's own profile)
    const participants = await step.run('get-participants', async () => {
      return db
        .select({ email: profileUsers.email })
        .from(profileUsers)
        .where(eq(profileUsers.profileId, instanceData.profileId!));
    });

    if (participants.length === 0) {
      console.warn('No participants found for process:', processInstanceId);
      return;
    }

    const processUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${instanceData.profileSlug}`;

    // Step 3: Send batch notification emails
    const result = await step.run('send-emails', async () => {
      try {
        const emails = participants.map(({ email }) => ({
          to: email,
          subject: PhaseTransitionEmail.subject(
            instanceData.profileName,
            phaseName,
          ),
          component: () =>
            PhaseTransitionEmail({
              processTitle: instanceData.profileName,
              phaseName,
              phaseDescription,
              processUrl,
            }),
        }));

        const { data, errors } = await OPBatchSend(emails);

        if (errors.length > 0) {
          throw new Error(`Email batch failed: ${JSON.stringify(errors)}`);
        }

        return { sent: data.length };
      } catch (error) {
        console.error('Failed to send phase transition notifications:', {
          error,
          processInstanceId,
          toPhaseId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} phase transition notification(s) sent`,
    };
  },
);
