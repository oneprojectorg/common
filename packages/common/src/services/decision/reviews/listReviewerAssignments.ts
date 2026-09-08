import { and, count, db, eq, sql } from '@op/db/client';
import {
  ProposalReviewState,
  proposalReviewAssignments,
  proposalReviews,
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

/** One page of a reviewer's queue for the admin screen, with whole-queue totals. */
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

  // No org fallback: legacy instances without their own profile fail closed.
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
    }),
    getReviewerQueueTotals({ processInstanceId, phaseId, reviewerProfileId }),
    getEligibleReviewerProfileIds({ decisionProfileId: instance.profileId }),
  ]);

  // Any id can be put in the URL; withhold identity unless tied to this process.
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

/** Whole-queue counts: the page drops merged-away proposals that still count as done work. */
async function getReviewerQueueTotals({
  processInstanceId,
  phaseId,
  reviewerProfileId,
}: {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
}): Promise<ReviewerQueueTotals> {
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
      .leftJoin(proposalReviews, reviewOfAssignment)
      .where(reviewerQueue),
    db
      .select({
        status: statusKey.as('status'),
        count: count(proposalReviewAssignments.id),
      })
      .from(proposalReviewAssignments)
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
