import { listIndividualProfileRecipients } from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { OPBatchSend, ReviewSubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { reviewSubmitted } = Events;

export const sendReviewSubmittedNotification = inngest.createFunction(
  {
    id: 'sendReviewSubmittedNotification',
    idempotency: 'event.data.assignmentId',
  },
  { event: reviewSubmitted.name },
  async ({ event, step, runId }) => {
    const { assignmentId } = reviewSubmitted.schema.parse(event.data);

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
        },
      });
    });

    if (!assignment) {
      logger.error('No assignment data found for assignment', { assignmentId });
      return;
    }

    // The assignment may have moved on (e.g. back to revision) since the event.
    if (assignment.status !== ProposalReviewAssignmentStatus.COMPLETED) {
      logger.info('Assignment is no longer completed', {
        assignmentId,
        status: assignment.status,
      });
      return;
    }

    const { proposal, processInstance } = assignment;

    const owners = await step.run('get-reviewer-recipients', () =>
      listIndividualProfileRecipients(assignment.reviewerProfileId),
    );
    const [reviewerEmail] = selectEmailRecipients(owners);

    if (!reviewerEmail) {
      logger.warn('No reviewer address found for reviewer profile', {
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
    const reviewUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/reviews/${assignmentId}`;

    await step.run('send-email', async () => {
      const { errors } = await OPBatchSend(
        [
          {
            to: reviewerEmail,
            subject: ReviewSubmittedEmail.subject(proposalName),
            component: () =>
              ReviewSubmittedEmail({
                proposalName,
                processTitle,
                reviewUrl,
              }),
          },
        ],
        { idempotencyKeyPrefix: `review-submitted/${runId}` },
      );

      // Counts only — `errors` carries the address, which must reach neither
      // the log nor the thrown message.
      if (errors.length > 0) {
        logger.error('Review submitted notification failed to send', {
          assignmentId,
          failedCount: errors.length,
        });
        throw new Error('Review submitted notification failed to send');
      }

      return { sent: true };
    });
  },
);
