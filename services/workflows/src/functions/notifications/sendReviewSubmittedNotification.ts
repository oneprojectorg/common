import { listProfileRecipients } from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
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
    // One confirmation per assignment. A reviewer submits an assignment once;
    // later edits go through updateReview, which emits nothing.
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
          reviewer: {
            columns: {
              id: true,
              type: true,
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

    const reviewerRecipients = await step.run('get-reviewer-recipients', () =>
      listProfileRecipients(reviewer),
    );
    const recipients = selectEmailRecipients(reviewerRecipients);

    if (recipients.length === 0) {
      logger.warn('No reviewer addresses found for reviewer profile', {
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
    const reviewUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/reviews/${assignmentId}`;

    const result = await step.run('send-emails', async () => {
      const emails = recipients.map((email) => ({
        to: email,
        subject: ReviewSubmittedEmail.subject(proposalName),
        component: () =>
          ReviewSubmittedEmail({
            proposalName,
            processTitle,
            reviewUrl,
            completedCount: progress?.completed,
            totalCount: progress?.total,
          }),
      }));

      const { errors } = await OPBatchSend(emails, {
        // Stable across retries, unique per run: a step retry replays what
        // already went out instead of sending the reviewer a second copy.
        idempotencyKeyPrefix: `review-submitted/${runId}`,
      });

      // Counts only — `errors` carries the recipient address, which must not
      // reach the log sink.
      if (errors.length > 0) {
        logger.error('Some review submitted notifications failed to send', {
          assignmentId,
          failedCount: errors.length,
        });
      }

      return {
        sent: emails.length - errors.length,
        failed: errors.length,
      };
    });

    return {
      message: `${result.sent} review submitted notification(s) sent, ${result.failed} failed`,
    };
  },
);
