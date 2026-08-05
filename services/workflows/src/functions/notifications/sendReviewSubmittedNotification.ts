import { hasEmail } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { and, count, db, eq, sql } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import { OPBatchSend, ReviewSubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { reviewSubmitted } = Events;

export const sendReviewSubmittedNotification = inngest.createFunction(
  {
    id: 'sendReviewSubmittedNotification',
    debounce: {
      key: 'event.data.assignmentId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: reviewSubmitted.name },
  async ({ event, step }) => {
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
          reviewer: {
            with: {
              profileUsers: {
                where: { email: { isNotNull: true } },
              },
            },
          },
        },
      });
    });

    if (!assignment) {
      logger.error('No assignment data found for assignment', { assignmentId });
      return;
    }

    // Verify the review is still submitted before confirming it — the
    // assignment may have moved on (e.g. back to revision) since the event.
    if (assignment.status !== ProposalReviewAssignmentStatus.COMPLETED) {
      logger.info('Assignment is no longer completed', {
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

    // The reviewer's own phase progress ("N of M reviews done in this phase").
    const progress = await step.run('get-review-progress', async () => {
      const [row] = await db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${eq(
            proposalReviewAssignments.status,
            ProposalReviewAssignmentStatus.COMPLETED,
          )})`.mapWith(Number),
        })
        .from(proposalReviewAssignments)
        .where(
          and(
            eq(
              proposalReviewAssignments.processInstanceId,
              assignment.processInstanceId,
            ),
            eq(proposalReviewAssignments.phaseId, assignment.phaseId),
            eq(
              proposalReviewAssignments.reviewerProfileId,
              assignment.reviewerProfileId,
            ),
          ),
        );

      return row ?? null;
    });

    const proposalName = proposal.profile.name;
    const processTitle = processProfile.name;
    const reviewsUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/reviews`;

    const result = await step.run('send-emails', async () => {
      try {
        const emails = reviewerEmails.map(({ email }) => ({
          to: email,
          subject: ReviewSubmittedEmail.subject(proposalName),
          component: () =>
            ReviewSubmittedEmail({
              proposalName,
              processTitle,
              reviewsUrl,
              completedCount: progress?.completed,
              totalCount: progress?.total,
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
        logger.error('Failed to send review submitted notifications', {
          error,
          assignmentId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} review submitted notification(s) sent`,
    };
  },
);
