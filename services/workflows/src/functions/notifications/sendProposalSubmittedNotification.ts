import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  processInstances,
  profileUsers,
  profiles,
  proposals,
} from '@op/db/schema';
import { OPBatchSend, ProposalSubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const { proposalSubmitted } = Events;

export const sendProposalSubmittedNotification = inngest.createFunction(
  {
    id: 'sendProposalSubmittedNotification',
    debounce: {
      key: 'event.data.proposalId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: proposalSubmitted.name },
  async ({ event, step }) => {
    const { proposalId } = proposalSubmitted.schema.parse(event.data);

    const proposalProfile = alias(profiles, 'proposal_profile');
    const processProfile = alias(profiles, 'process_profile');

    // Step 1: Get proposal, its profile name, and the process instance profile (name + slug)
    const proposalData = await step.run('get-proposal-data', async () => {
      const result = await db
        .select({
          proposalProfileId: proposals.profileId,
          proposalProfileName: proposalProfile.name,
          processProfileName: processProfile.name,
          processProfileSlug: processProfile.slug,
        })
        .from(proposals)
        .innerJoin(proposalProfile, eq(proposals.profileId, proposalProfile.id))
        .innerJoin(
          processInstances,
          eq(proposals.processInstanceId, processInstances.id),
        )
        .innerJoin(
          processProfile,
          eq(processInstances.profileId, processProfile.id),
        )
        .where(eq(proposals.id, proposalId))
        .limit(1);

      return result[0];
    });

    if (!proposalData) {
      console.log('No proposal data found for proposal:', proposalId);
      return;
    }

    // Step 2: Get all collaborator emails
    const collaborators = await step.run('get-collaborators', async () => {
      return db
        .select({
          email: profileUsers.email,
        })
        .from(profileUsers)
        .where(eq(profileUsers.profileId, proposalData.proposalProfileId));
    });

    if (collaborators.length === 0) {
      console.log('No collaborators found for proposal:', proposalId);
      return;
    }

    const proposalUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${proposalData.processProfileSlug}/proposal/${proposalData.proposalProfileId}`;

    // Step 3: Send notification emails to all collaborators
    const result = await step.run('send-emails', async () => {
      try {
        const emails = collaborators.map(({ email }) => ({
          to: email,
          subject: ProposalSubmittedEmail.subject(
            proposalData.proposalProfileName,
            proposalData.processProfileName,
          ),
          component: () =>
            ProposalSubmittedEmail({
              proposalName: proposalData.proposalProfileName,
              processTitle: proposalData.processProfileName,
              proposalUrl,
            }),
        }));

        const { data, errors } = await OPBatchSend(emails);

        if (errors.length > 0) {
          throw Error(`Email batch failed: ${JSON.stringify(errors)}`);
        }

        return {
          sent: data.length,
          failed: errors.length,
          errors,
        };
      } catch (error) {
        console.error('Failed to send proposal submitted notifications:', {
          error,
          proposalId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} proposal submitted notification(s) sent, ${result.failed} failed`,
    };
  },
);
