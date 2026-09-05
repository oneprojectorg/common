import { listProfileRecipients } from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
} from '@op/db/schema';
import { OPBatchSend, RevisionRequestedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

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
              profile: true,
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
      logger.error('No assignment data found for assignment', { assignmentId });
      return;
    }

    // Verify the revision request is still active before sending
    const revisionRequest = assignment.requests.find(
      (r) => r.id === revisionRequestId,
    );

    if (!revisionRequest) {
      logger.warn('Revision request not found', { revisionRequestId });
      return;
    }

    if (revisionRequest.state !== ProposalReviewRequestState.REQUESTED) {
      logger.info('Revision request is no longer active', {
        revisionRequestId,
        state: revisionRequest.state,
      });
      return;
    }

    if (
      assignment.status !==
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION
    ) {
      logger.info('Assignment is no longer awaiting revision', {
        assignmentId,
        status: assignment.status,
      });
      return;
    }

    const { proposal, processInstance } = assignment;

    const authors = await step.run('get-author-recipients', async () =>
      listProfileRecipients({ profileId: proposal.profileId }),
    );
    const recipients = selectEmailRecipients(authors);

    if (recipients.length === 0) {
      logger.warn('No author addresses found for proposal profile', {
        profileId: proposal.profileId,
      });
      return;
    }

    const processProfile = processInstance.profile;
    if (!processProfile) {
      logger.error('No profile found for process instance', {
        processInstanceId: processInstance.id,
      });
      return;
    }

    const proposalName = proposal.profile.name;
    const processTitle = processProfile.name;
    const proposalUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/proposal/${proposal.profileId}/edit?reviewRevision=${revisionRequestId}`;

    const result = await step.run('send-emails', async () => {
      try {
        const emails = recipients.map((email) => ({
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
        logger.error('Failed to send revision requested notifications', {
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
