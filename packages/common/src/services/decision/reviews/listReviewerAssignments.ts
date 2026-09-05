import { and, count, db, eq, isNull, sql } from '@op/db/client';
import {
  ProposalReviewState,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { getEligibleReviewerProfileIds } from '../getEligibleReviewerProfileIds';
import { getInstance } from '../getInstance';
import { listAssignmentsForReviewer } from '../listReviewAssignments';
import type { InstancePhaseRef } from '../schemas/instance';
import {
  type ReviewerAssignments,
  type ReviewerQueueStatus,
  reviewerAssignmentsSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';

interface ReviewerQueueTotals {
  assignedCount: number;
  submittedCount: number;
  draftCount: number;
  lastSubmittedAt: string | null;
  statusBreakdown: Array<{ status: ReviewerQueueStatus; count: number }>;
}

/**
 * One page of a reviewer's queue for the admin screen, with whole-queue totals.
 * The assignments come off the same query, in the same shape, as the
 * reviewer's own "Proposals to review" list.
 */
export async function listReviewerAssignments({
  user,
  processInstanceId,
  phaseId,
  reviewerProfileId,
  cursor,
  limit,
}: InstancePhaseRef & {
  user: User;
  reviewerProfileId: string;
  /** Opaque position from the previous page's `next`. */
  cursor?: string | null;
  limit: number;
}): Promise<ReviewerAssignments> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  // No org fallback: admin access comes from a grant on the instance's own
  // profile, which legacy instances may not have — fail closed there.
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  const [reviewer, queue, totals, eligibleProfileIds] = await Promise.all([
    db.query.profiles.findFirst({
      where: { id: reviewerProfileId },
      columns: {
        id: true,
        name: true,
        slug: true,
        avatarImageId: true,
        email: true,
      },
    }),
    listAssignmentsForReviewer({
      instance,
      reviewerProfileId,
      phaseId,
      // A worklist, not the reviewer's own coverage-spreading order.
      sort: 'oldest',
      cursor,
      limit,
      excludeUnreachableProposals: true,
    }),
    getReviewerQueueTotals({ processInstanceId, phaseId, reviewerProfileId }),
    getEligibleReviewerProfileIds({ decisionProfileId: instance.profileId }),
  ]);

  // Any id can be put in the URL, so identity is withheld unless the profile
  // is tied to this process — else this reads back a stranger's email.
  const isEligible = eligibleProfileIds.includes(reviewerProfileId);
  const isAssociated = isEligible || totals.assignedCount > 0;

  return reviewerAssignmentsSchema.parse({
    reviewer: isAssociated ? (reviewer ?? null) : null,
    isEligible,
    ...totals,
    assignments: queue.assignments,
    next: queue.next,
    total: queue.total,
  });
}

/**
 * Not derived from the returned page: a page is a window, and the list drops
 * merged-away proposals while a reviewer's progress should still count the
 * work they did on one.
 */
async function getReviewerQueueTotals({
  processInstanceId,
  phaseId,
  reviewerProfileId,
}: {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
}): Promise<ReviewerQueueTotals> {
  // Deleted and moderation-detached proposals are invisible even to admins,
  // so this join is the filter as well as the lookup.
  const reachableProposal = and(
    eq(proposals.id, proposalReviewAssignments.proposalId),
    isNull(proposals.deletedAt),
    isNull(proposals.moderationDetachedAt),
  );
  const reviewOfAssignment = eq(
    proposalReviews.assignmentId,
    proposalReviewAssignments.id,
  );
  const reviewerQueue = and(
    eq(proposalReviewAssignments.processInstanceId, processInstanceId),
    eq(proposalReviewAssignments.phaseId, phaseId),
    eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
  );

  // The same `review.state ?? assignment.status` the cards show.
  const statusKey = sql<ReviewerQueueStatus>`COALESCE(${proposalReviews.state}::text, ${proposalReviewAssignments.status}::text)`;

  const [[row], breakdownRows] = await Promise.all([
    db
      .select({
        assignedCount: count(proposalReviewAssignments.id),
        submittedCount:
          sql<number>`(count(*) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED}))::int`.mapWith(
            Number,
          ),
        draftCount:
          sql<number>`(count(*) filter (where ${proposalReviews.state} = ${ProposalReviewState.DRAFT}))::int`.mapWith(
            Number,
          ),
        lastSubmittedAt: sql<
          string | null
        >`max(${proposalReviews.submittedAt}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED})`,
      })
      .from(proposalReviewAssignments)
      .innerJoin(proposals, reachableProposal)
      .leftJoin(proposalReviews, reviewOfAssignment)
      .where(reviewerQueue),
    db
      .select({
        status: statusKey.as('status'),
        count: count(proposalReviewAssignments.id),
      })
      .from(proposalReviewAssignments)
      .innerJoin(proposals, reachableProposal)
      .leftJoin(proposalReviews, reviewOfAssignment)
      .where(reviewerQueue)
      .groupBy(statusKey),
  ]);

  return {
    assignedCount: row?.assignedCount ?? 0,
    submittedCount: row?.submittedCount ?? 0,
    draftCount: row?.draftCount ?? 0,
    lastSubmittedAt: row?.lastSubmittedAt ?? null,
    statusBreakdown: breakdownRows,
  };
}
