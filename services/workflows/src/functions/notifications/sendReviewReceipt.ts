import {
  type DecisionInstanceData,
  getPhaseRubricTemplate,
  proposalReviewSchema,
  resolveAssignmentProposal,
  resolveSubmittedReview,
} from '@op/common';
import { OPURLConfig, genericEmail } from '@op/core';
import { db } from '@op/db/client';
import { ProposalReviewState, profileUsers } from '@op/db/schema';
import { OPNodemailer, ReviewReceiptEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const { reviewSubmitted, reviewUpdated } = Events;

const emailDomain = genericEmail.split('@')[1] ?? 'oneproject.org';

/**
 * Emails the reviewer a receipt of their own review. Both events funnel in
 * and are debounced together on the assignment, so a submit followed by a
 * quick edit yields one receipt; the review is read fresh from the database,
 * so a collapsed burst is correct by construction.
 *
 * Every receipt for one assignment shares a synthetic `References` root so
 * mail clients thread them, while each send gets its own `Message-ID`.
 */
export const sendReviewReceipt = inngest.createFunction(
  {
    id: 'sendReviewReceipt',
    debounce: {
      key: 'event.data.assignmentId',
      period: '1m',
      timeout: '3m',
    },
  },
  [{ event: reviewSubmitted.name }, { event: reviewUpdated.name }],
  async ({ event, step }) => {
    const { assignmentId } = reviewSubmitted.schema.parse(event.data);

    const assignment = await step.run('get-review-data', async () => {
      return db.query.proposalReviewAssignments.findFirst({
        where: { id: assignmentId },
        with: {
          reviews: true,
          assignedProposalHistory: true,
          proposal: true,
          processInstance: {
            with: {
              profile: true,
            },
          },
        },
      });
    });

    if (!assignment) {
      logger.error('No assignment found for review receipt', { assignmentId });
      return;
    }

    const review = assignment.reviews[0];
    const submittedAt = review?.submittedAt;
    if (
      !review ||
      review.state !== ProposalReviewState.SUBMITTED ||
      !submittedAt
    ) {
      logger.info('No submitted review found for assignment', { assignmentId });
      return;
    }

    const rubricTemplate = getPhaseRubricTemplate(
      assignment.processInstance.instanceData as DecisionInstanceData,
      assignment.phaseId,
    );

    if (!rubricTemplate) {
      logger.error('No rubric template found for assignment', { assignmentId });
      return;
    }

    // Reviewer profiles are always personal profiles
    // (getEligibleReviewerProfileIds selects users.profileId), so a single
    // profileUsers row lookup is exact here.
    const reviewerEmail = await step.run('get-reviewer-email', async () => {
      const result = await db
        .select({ email: profileUsers.email })
        .from(profileUsers)
        .where(eq(profileUsers.profileId, assignment.reviewerProfileId))
        .limit(1);

      return result[0]?.email ?? null;
    });

    if (!reviewerEmail) {
      logger.info('No email found for reviewer profile', {
        reviewerProfileId: assignment.reviewerProfileId,
      });
      return;
    }

    const processProfile = assignment.processInstance.profile;
    if (!processProfile) {
      logger.error('No profile found for process instance', {
        processInstanceId: assignment.processInstanceId,
      });
      return;
    }

    // The snapshot the reviewer actually read, not the live proposal.
    const proposalSnapshot = resolveAssignmentProposal(assignment);
    const proposalTitle =
      proposalSnapshot.proposalData.title ?? 'Untitled proposal';

    const resolved = resolveSubmittedReview(
      rubricTemplate,
      proposalReviewSchema.parse(review),
      { t: (key) => key },
    );

    const reviewUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/reviews/${assignmentId}`;

    // Distinguishes the receipts of one assignment from each other inside the
    // shared References thread.
    const changeStamp = Date.parse(review.updatedAt ?? submittedAt);

    await step.run('send-email', async () => {
      try {
        await OPNodemailer({
          to: reviewerEmail,
          subject: ReviewReceiptEmail.subject(proposalTitle),
          component: () =>
            ReviewReceiptEmail({
              processTitle: processProfile.name,
              proposalTitle,
              submittedAt,
              updatedAt: review.updatedAt,
              items: resolved.answers,
              feedbackToAuthor: resolved.overallComment,
              reviewUrl,
            }),
          messageId: `<review-receipt.${assignmentId}.${changeStamp}@${emailDomain}>`,
          references: `<review-receipt.${assignmentId}@${emailDomain}>`,
        });
      } catch (error) {
        logger.error('Failed to send review receipt', {
          error,
          assignmentId,
        });
        throw error;
      }
    });

    return {
      message: 'Review receipt sent',
    };
  },
);
