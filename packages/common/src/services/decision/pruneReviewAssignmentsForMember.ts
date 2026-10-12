import { and, db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import { logger } from '@op/logging';

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
 * Idempotent removal of a member's pending review assignments in the
 * instance's current phase once they no longer hold the REVIEW capability —
 * used when a member loses roles or leaves the decision mid-phase.
 *
 * Eligibility is re-derived from current roles, never from the roles a caller
 * reports as removed. Started and submitted assignments are kept, because
 * their reviews cascade off the assignment. Expected no-op states are logged
 * skips, not errors.
 */
export async function pruneReviewAssignmentsForMember({
  instanceId,
  reviewerProfileId,
}: PruneReviewAssignmentsForMemberInput): Promise<PruneReviewAssignmentsForMemberResult> {
  const skip = (reason: string): PruneReviewAssignmentsForMemberResult => {
    logger.info('pruneReviewAssignmentsForMember: skipped', {
      instanceId,
      reason,
    });
    return { skipped: reason };
  };

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    return skip('instance not found');
  }
  if (instance.status !== ProcessStatus.PUBLISHED) {
    return skip(`instance is not published (status: ${instance.status})`);
  }
  if (!instance.profileId) {
    return skip('instance has no profileId');
  }
  const currentPhaseId = instance.currentStateId;
  if (!currentPhaseId) {
    return skip('instance has no current phase');
  }

  const instanceData = instance.instanceData as DecisionInstanceData;

  const currentPhase = assertInstancePhase({
    instance: { instanceData },
    phaseId: currentPhaseId,
  });
  if (!isReviewPhase(currentPhase)) {
    return skip('current phase is not review-capable');
  }

  const eligibleReviewerProfileIds = await getEligibleReviewerProfileIds({
    decisionProfileId: instance.profileId,
  });
  if (eligibleReviewerProfileIds.includes(reviewerProfileId)) {
    return skip('member is still eligible to review');
  }

  // PENDING lives in the statement, not a prior read: a row started in the
  // meantime keeps its draft review, which would otherwise cascade away.
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
