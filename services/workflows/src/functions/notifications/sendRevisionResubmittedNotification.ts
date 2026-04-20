import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  processInstances,
  profileUsers,
  profiles,
  proposalReviewAssignments,
  proposalReviewRequests,
  proposals,
} from '@op/db/schema';
import { OPBatchSend, RevisionResubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const { reviewRevisionResubmitted } = Events;

export const sendRevisionResubmittedNotification = inngest.createFunction(
  {
    id: 'sendRevisionResubmittedNotification',
    debounce: {
      key: 'event.data.revisionRequestId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: reviewRevisionResubmitted.name },
  async ({ event, step }) => {
    const { revisionRequestId } = reviewRevisionResubmitted.schema.parse(
      event.data,
    );

    const proposalProfile = alias(profiles, 'proposal_profile');
    const processProfile = alias(profiles, 'process_profile');

    // Step 1: Get revision request context: proposal + process profile info
    const context = await step.run('get-revision-context', async () => {
      const result = await db
        .select({
          proposalProfileId: proposals.profileId,
          proposalProfileName: proposalProfile.name,
          processProfileName: processProfile.name,
          processProfileSlug: processProfile.slug,
        })
        .from(proposalReviewRequests)
        .innerJoin(
          proposalReviewAssignments,
          eq(proposalReviewRequests.assignmentId, proposalReviewAssignments.id),
        )
        .innerJoin(
          proposals,
          eq(proposalReviewAssignments.proposalId, proposals.id),
        )
        .innerJoin(proposalProfile, eq(proposals.profileId, proposalProfile.id))
        .innerJoin(
          processInstances,
          eq(proposalReviewAssignments.processInstanceId, processInstances.id),
        )
        .innerJoin(
          processProfile,
          eq(processInstances.profileId, processProfile.id),
        )
        .where(eq(proposalReviewRequests.id, revisionRequestId))
        .limit(1);

      return result[0];
    });

    if (!context) {
      console.log(
        'No revision request context found for request:',
        revisionRequestId,
      );
      return;
    }

    // Step 2: Get all author (proposal profile) emails
    const collaborators = await step.run('get-collaborators', async () => {
      return db
        .select({
          email: profileUsers.email,
        })
        .from(profileUsers)
        .where(eq(profileUsers.profileId, context.proposalProfileId));
    });

    if (collaborators.length === 0) {
      console.log(
        'No collaborators found for revision request:',
        revisionRequestId,
      );
      return;
    }

    const proposalUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${context.processProfileSlug}/proposal/${context.proposalProfileId}`;

    // Step 3: Send notification emails to all collaborators
    const result = await step.run('send-emails', async () => {
      try {
        const emails = collaborators.map(({ email }) => ({
          to: email,
          subject: RevisionResubmittedEmail.subject(
            context.proposalProfileName,
          ),
          component: () =>
            RevisionResubmittedEmail({
              proposalName: context.proposalProfileName,
              processTitle: context.processProfileName,
              proposalUrl,
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
        console.error('Failed to send revision resubmitted notifications:', {
          error,
          revisionRequestId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} revision resubmitted notification(s) sent`,
    };
  },
);
