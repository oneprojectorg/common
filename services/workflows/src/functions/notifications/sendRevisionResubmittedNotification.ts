import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
} from '@op/db/schema';
import { OPBatchSend, RevisionResubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';

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
    const { assignmentId, revisionRequestId } =
      reviewRevisionResubmitted.schema.parse(event.data);

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

    // Verify the revision request has been resubmitted before sending
    const revisionRequest = assignment.requests.find(
      (r) => r.id === revisionRequestId,
    );

    if (!revisionRequest) {
      console.warn('Revision request not found:', revisionRequestId);
      return;
    }

    if (revisionRequest.state !== ProposalReviewRequestState.RESUBMITTED) {
      console.log(
        'Revision request is not in resubmitted state:',
        revisionRequestId,
        'state:',
        revisionRequest.state,
      );
      return;
    }

    if (
      assignment.status !== ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW
    ) {
      console.log(
        'Assignment is not ready for re-review:',
        assignmentId,
        'status:',
        assignment.status,
      );
      return;
    }

    const { proposal, processInstance } = assignment;
    const authorEmails = proposal.profile.profileUsers;

    if (authorEmails.length === 0) {
      console.warn(
        'No author emails found for proposal profile:',
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
    const proposalUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/reviews/${assignmentId}`;

    const result = await step.run('send-emails', async () => {
      try {
        const emails = authorEmails.map(({ email }) => ({
          to: email,
          subject: RevisionResubmittedEmail.subject(proposalName),
          component: () =>
            RevisionResubmittedEmail({
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
        console.error('Failed to send revision resubmitted notifications:', {
          error,
          assignmentId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} revision resubmitted notification(s) sent`,
    };
  },
);
