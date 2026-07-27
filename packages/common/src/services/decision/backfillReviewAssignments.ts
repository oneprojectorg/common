import { db } from '@op/db/client';
import { ProcessStatus, ProposalStatus } from '@op/db/schema';
import { logger } from '@op/logging';

import { getEligibleReviewerProfileIds } from './getEligibleReviewerProfileIds';
import { insertReviewAssignments } from './insertReviewAssignments';
import type { DecisionInstanceData } from './schemas/instanceData';
import { assertInstancePhase } from './utils/instance';

export interface BackfillReviewAssignmentsInput {
  instanceId: string;
  /** Narrowing hint; eligibility is still re-checked against current roles. */
  reviewerProfileIds?: string[];
}

export type BackfillReviewAssignmentsResult =
  | { skipped: string }
  | { inserted: number; reviewerCount: number; proposalCount: number };

/**
 * Idempotent, add-only backfill of review assignments for the instance's
 * current phase — used when a member gains the reviewer capability mid-phase.
 *
 * The proposal set is the phase's inbound transition attachment set, NOT live
 * phase membership: mid-phase submissions were never assigned to existing
 * reviewers, and the new reviewer must match them exactly. Never prunes —
 * deleting non-pending assignments would cascade-delete submitted reviews.
 * Guards no-op with a log so event-driven callers can invoke it blindly.
 */
export async function backfillReviewAssignments({
  instanceId,
  reviewerProfileIds,
}: BackfillReviewAssignmentsInput): Promise<BackfillReviewAssignmentsResult> {
  const skip = (reason: string): BackfillReviewAssignmentsResult => {
    logger.info('backfillReviewAssignments: skipped', { instanceId, reason });
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

  const reviewsPolicy = instanceData.config?.reviewsPolicy;
  if (reviewsPolicy && reviewsPolicy !== 'full_coverage') {
    return skip(`reviews policy '${reviewsPolicy}' is not backfillable`);
  }

  const currentPhase = assertInstancePhase({
    instance: { instanceData },
    phaseId: currentPhaseId,
  });
  if (!currentPhase.rules?.proposals?.review) {
    return skip('current phase is not review-capable');
  }

  // Most recent transition INTO the current phase — the one whose attachment
  // set fed generateReviewAssignments.
  const inboundTransition = await db.query.stateTransitionHistory.findFirst({
    where: {
      processInstanceId: instanceId,
      toStateId: currentPhaseId,
    },
    orderBy: { transitionedAt: 'desc' },
    columns: { id: true },
  });

  if (!inboundTransition) {
    // Initial phase: generation never ran, nothing to reach parity with.
    return skip('current phase has no inbound transition');
  }

  const [attachedProposals, eligibleReviewerProfileIds] = await Promise.all([
    db.query.decisionTransitionProposals.findMany({
      where: {
        transitionHistoryId: inboundTransition.id,
        proposal: {
          status: { ne: ProposalStatus.DRAFT },
          deletedAt: { isNull: true },
          moderationDetachedAt: { isNull: true },
        },
      },
      columns: { proposalId: true, proposalHistoryId: true },
      with: { proposal: { columns: { submittedByProfileId: true } } },
    }),

    getEligibleReviewerProfileIds({
      decisionProfileId: instance.profileId,
    }),
  ]);

  const targetReviewerIds = reviewerProfileIds
    ? eligibleReviewerProfileIds.filter((id) => reviewerProfileIds.includes(id))
    : eligibleReviewerProfileIds;

  const inserted = await insertReviewAssignments({
    instanceId,
    phaseId: currentPhaseId,
    reviewerProfileIds: targetReviewerIds,
    assignableProposals: attachedProposals.map((row) => ({
      proposalId: row.proposalId,
      submittedByProfileId: row.proposal.submittedByProfileId,
      assignedProposalHistoryId: row.proposalHistoryId,
    })),
  });

  return {
    inserted,
    reviewerCount: targetReviewerIds.length,
    proposalCount: attachedProposals.length,
  };
}
