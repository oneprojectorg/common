import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
} from '@op/db/schema';
import { OPBatchSend, RevisionRequestedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';

const { reviewRevisionRequested } = Events;

export const sendRevisionRequestedNotification = inngest.createFunction(
  {
    id: 'sendRevisionRequestedNotification',
    debounce: {
      key: 'event.data.revisionRequestId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: reviewRevisionRequested.name },
  async ({ event, step }) => {
    const { assignmentId, revisionRequestId } =
      reviewRevisionRequested.schema.parse(event.data);

    const assignment = await step.run('get-assignment-data', async () => {
      return db.query.proposalReviewAssignments.findFirst({
        where: { id: assignmentId },
        with: {
          proposal: {
            with: {
              profile: {
                with: {
                  profileUsers: true,
                },
              },
            },
          },
          processInstance: {
            with: {
              profile: true,
            },
          },
          requests: true,
        },
      });
    });

    if (!assignment) {
      console.error('No assignment data found for assignment:', assignmentId);
      return;
    }

    // Verify the revision request is still active before sending
    const revisionRequest = assignment.requests.find(
      (r) => r.id === revisionRequestId,
    );

    if (!revisionRequest) {
      console.warn('Revision request not found:', revisionRequestId);
      return;
    }

    if (revisionRequest.state !== ProposalReviewRequestState.REQUESTED) {
      console.log(
        'Revision request is no longer active:',
        revisionRequestId,
        'state:',
        revisionRequest.state,
      );
      return;
    }

    if (
      assignment.status !==
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION
    ) {
      console.log(
        'Assignment is no longer awaiting revision:',
        assignmentId,
        'status:',
        assignment.status,
      );
      return;
    }

    const { proposal, processInstance } = assignment;
    const authorProfileUsers = proposal.profile.profileUsers;

    if (authorProfileUsers.length === 0) {
      console.warn(
        'No author profile users found for proposal profile:',
        proposal.profileId,
      );
      return;
    }

    const processProfile = processInstance.profile;
    if (!processProfile) {
      console.error(
        'No profile found for process instance:',
        processInstance.id,
      );
      return;
    }

    const proposalName = proposal.profile.name;
    const processTitle = processProfile.name;
    const proposalUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/proposal/${proposal.profileId}/edit?reviewRevision=${revisionRequestId}`;

    const result = await step.run('send-emails', async () => {
      try {
        const emails = authorProfileUsers.map(({ email }) => ({
          to: email,
          subject: RevisionRequestedEmail.subject(proposalName),
          component: () =>
            RevisionRequestedEmail({
              proposalName,
              processTitle,
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
        console.error('Failed to send revision requested notifications:', {
          error,
          assignmentId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} revision requested notification(s) sent`,
    };
  },
);
