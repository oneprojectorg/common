import { hasEmail } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
} from '@op/db/schema';
import { OPBatchSend, RevisionResubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { reviewRevisionResubmitted } = Events;

export const sendRevisionResubmittedNotification = inngest.createFunction(
  {
    id: 'sendRevisionResubmittedNotification',
    // Symmetric with sendRevisionRequestedNotification: cap per revision
    // request so one busy proposal can't crowd the pool.
    concurrency: {
      limit: 5,
      key: 'event.data.revisionRequestId',
    },
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
              profile: true,
            },
          },
          processInstance: {
            with: {
              profile: true,
            },
          },
          reviewer: {
            with: {
              profileUsers: {
                where: { email: { isNotNull: true } },
              },
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

    // Verify the revision request has been resubmitted before sending
    const revisionRequest = assignment.requests.find(
      (r) => r.id === revisionRequestId,
    );

    if (!revisionRequest) {
      logger.warn('Revision request not found', { revisionRequestId });
      return;
    }

    if (revisionRequest.state !== ProposalReviewRequestState.RESUBMITTED) {
      logger.info('Revision request is not in resubmitted state', {
        revisionRequestId,
        state: revisionRequest.state,
      });
      return;
    }

    if (
      assignment.status !== ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW
    ) {
      logger.info('Assignment is not ready for re-review', {
        assignmentId,
        status: assignment.status,
      });
      return;
    }

    const { proposal, processInstance, reviewer } = assignment;
    const reviewerEmails = reviewer.profileUsers.filter(hasEmail);

    if (reviewerEmails.length === 0) {
      logger.warn('No reviewer emails found for reviewer profile', {
        reviewerProfileId: assignment.reviewerProfileId,
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
    const proposalUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/reviews/${assignmentId}`;

    const result = await step.run('send-emails', async () => {
      try {
        const emails = reviewerEmails.map(({ email }) => ({
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
        logger.error('Failed to send revision resubmitted notifications', {
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
