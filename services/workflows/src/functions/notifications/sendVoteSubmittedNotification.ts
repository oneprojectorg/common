import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  decisionsVoteSubmissions,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { OPNodemailer, VoteSubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const { voteSubmitted } = Events;

interface PhaseData {
  phaseId: string;
  name?: string;
  startDate?: string;
}

function getNextSteps(
  phases: PhaseData[],
  currentStateId: string | null,
): { name: string; date?: string }[] {
  const currentIndex = phases.findIndex((p) => p.phaseId === currentStateId);
  if (currentIndex === -1) {
    return [];
  }

  return phases.slice(currentIndex + 1).map((phase) => ({
    name: phase.name ?? '',
    date: phase.startDate
      ? new Date(phase.startDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : undefined,
  }));
}

export const sendVoteSubmittedNotification = inngest.createFunction(
  {
    id: 'sendVoteSubmittedNotification',
    debounce: {
      key: 'event.data.voteSubmissionId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: voteSubmitted.name },
  async ({ event, step }) => {
    const { voteSubmissionId, processInstanceId } = voteSubmitted.schema.parse(
      event.data,
    );

    const processProfile = alias(profiles, 'process_profile');

    // Step 1: Get voter profile, process instance details, and phase data
    const voteData = await step.run('get-vote-data', async () => {
      const result = await db
        .select({
          voterProfileId: decisionsVoteSubmissions.submittedByProfileId,
          processProfileName: processProfile.name,
          processProfileSlug: processProfile.slug,
          instanceData: processInstances.instanceData,
          currentStateId: processInstances.currentStateId,
        })
        .from(decisionsVoteSubmissions)
        .innerJoin(
          processInstances,
          eq(decisionsVoteSubmissions.processInstanceId, processInstances.id),
        )
        .innerJoin(
          processProfile,
          eq(processInstances.profileId, processProfile.id),
        )
        .where(eq(decisionsVoteSubmissions.id, voteSubmissionId))
        .limit(1);

      return result[0];
    });

    if (!voteData) {
      console.log('No vote data found for submission:', voteSubmissionId);
      return;
    }

    // Step 2: Get voter's email
    const voterEmail = await step.run('get-voter-email', async () => {
      const result = await db
        .select({
          email: profileUsers.email,
        })
        .from(profileUsers)
        .where(eq(profileUsers.profileId, voteData.voterProfileId))
        .limit(1);

      return result[0]?.email ?? null;
    });

    if (!voterEmail) {
      console.log('No email found for voter profile:', voteData.voterProfileId);
      return;
    }

    const decisionUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${voteData.processProfileSlug}`;

    const instanceData = voteData.instanceData as {
      phases?: PhaseData[];
    } | null;
    const phases = instanceData?.phases ?? [];
    const nextSteps = getNextSteps(phases, voteData.currentStateId);

    // Step 3: Send notification email
    await step.run('send-email', async () => {
      try {
        await OPNodemailer({
          to: voterEmail,
          subject: VoteSubmittedEmail.subject(voteData.processProfileName),
          component: () =>
            VoteSubmittedEmail({
              processTitle: voteData.processProfileName,
              decisionUrl,
              nextSteps,
            }),
        });
      } catch (error) {
        console.error('Failed to send vote submitted notification:', {
          error,
          voteSubmissionId,
          processInstanceId,
        });
        throw error;
      }
    });

    return {
      message: 'Vote submitted notification sent',
    };
  },
);
