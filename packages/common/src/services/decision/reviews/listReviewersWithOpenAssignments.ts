import { db } from '@op/db/client';
import { proposalReviewAssignments } from '@op/db/schema';
import { and, asc, count, inArray } from 'drizzle-orm';

import { reviewSetPredicate } from '../phaseEligibility';
import { openAssignmentFilter } from './phaseReviewerRollup';

export interface ReviewerWithOpenAssignments {
  reviewerProfileId: string;
  remainingCount: number;
}

export async function listReviewersWithOpenAssignments({
  processInstanceId,
  phaseId,
  reviewerProfileIds,
}: {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileIds?: ReadonlyArray<string>;
}): Promise<Array<ReviewerWithOpenAssignments>> {
  if (reviewerProfileIds?.length === 0) {
    return [];
  }

  return db
    .select({
      reviewerProfileId: proposalReviewAssignments.reviewerProfileId,
      remainingCount: count(),
    })
    .from(proposalReviewAssignments)
    .where(
      and(
        // A proposal outside the phase's pool earns no reminder.
        reviewSetPredicate(proposalReviewAssignments, {
          processInstanceId,
          phaseId,
        }),
        openAssignmentFilter(),
        reviewerProfileIds
          ? inArray(proposalReviewAssignments.reviewerProfileId, [
              ...reviewerProfileIds,
            ])
          : undefined,
      ),
    )
    .groupBy(proposalReviewAssignments.reviewerProfileId)
    .orderBy(asc(proposalReviewAssignments.reviewerProfileId));
}
