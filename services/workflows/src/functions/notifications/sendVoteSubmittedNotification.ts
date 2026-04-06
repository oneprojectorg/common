import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  decisionsVoteSubmissions,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { OPBatchSend, VoteSubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const { voteSubmitted } = Events;

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

    // Step 1: Get voter profile and process instance details
    const voteData = await step.run('get-vote-data', async () => {
      const result = await db
        .select({
          voterProfileId: decisionsVoteSubmissions.submittedByProfileId,
          processProfileName: processProfile.name,
          processProfileSlug: processProfile.slug,
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

    // Step 2: Get voter's email(s)
    const voterEmails = await step.run('get-voter-emails', async () => {
      return db
        .select({
          email: profileUsers.email,
        })
        .from(profileUsers)
        .where(eq(profileUsers.profileId, voteData.voterProfileId));
    });

    if (voterEmails.length === 0) {
      console.log(
        'No emails found for voter profile:',
        voteData.voterProfileId,
      );
      return;
    }

    const decisionUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${voteData.processProfileSlug}`;

    // Step 3: Send notification emails
    const result = await step.run('send-emails', async () => {
      try {
        const emails = voterEmails.map(({ email }) => ({
          to: email,
          subject: VoteSubmittedEmail.subject(voteData.processProfileName),
          component: () =>
            VoteSubmittedEmail({
              processTitle: voteData.processProfileName,
              decisionUrl,
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
        console.error('Failed to send vote submitted notifications:', {
          error,
          voteSubmissionId,
          processInstanceId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} vote submitted notification(s) sent`,
    };
  },
);
