import { and, db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';

import { getEligibleReviewerProfileIds } from './getEligibleReviewerProfileIds';
import type { DecisionInstanceData } from './schemas/instanceData';
import { assertInstancePhase } from './utils/instance';
import { isReviewPhase } from './utils/phaseSettings';

export interface PruneReviewAssignmentsForMemberInput {
  instanceId: string;
  reviewerProfileId: string;
}

export type PruneReviewAssignmentsForMemberResult =
  | { skipped: string }
  | { removed: number };

/**
 * Removes a member's pending assignments in the current phase if their current
 * roles no longer grant REVIEW. Started assignments are kept, because their
 * reviews cascade off the assignment.
 */
export async function pruneReviewAssignmentsForMember({
  instanceId,
  reviewerProfileId,
}: PruneReviewAssignmentsForMemberInput): Promise<PruneReviewAssignmentsForMemberResult> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    return { skipped: 'instance not found' };
  }
  if (instance.status !== ProcessStatus.PUBLISHED) {
    return {
      skipped: `instance is not published (status: ${instance.status})`,
    };
  }
  if (!instance.profileId) {
    return { skipped: 'instance has no profileId' };
  }
  const currentPhaseId = instance.currentStateId;
  if (!currentPhaseId) {
    return { skipped: 'instance has no current phase' };
  }

  const instanceData = instance.instanceData as DecisionInstanceData;

  const currentPhase = assertInstancePhase({
    instance: { instanceData },
    phaseId: currentPhaseId,
  });
  if (!isReviewPhase(currentPhase)) {
    return { skipped: 'current phase is not review-capable' };
  }

  const eligibleReviewerProfileIds = await getEligibleReviewerProfileIds({
    decisionProfileId: instance.profileId,
  });
  if (eligibleReviewerProfileIds.includes(reviewerProfileId)) {
    return { skipped: 'member is still eligible to review' };
  }

  // PENDING is in the DELETE so a row started concurrently keeps its draft.
  const deleted = await db
    .delete(proposalReviewAssignments)
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, instanceId),
        eq(proposalReviewAssignments.phaseId, currentPhaseId),
        eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
        eq(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.PENDING,
        ),
      ),
    )
    .returning({ id: proposalReviewAssignments.id });

  return { removed: deleted.length };
}
