import { and, db, desc, eq, inArray } from '@op/db/client';
import {
  decisionTransitionProposals,
  proposalReviewAssignments,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { z } from 'zod';

import { NotFoundError, ValidationError } from '../../utils';
import { getEligibleReviewerProfileIds } from './generateReviewAssignments';

const phaseOrderData = z
  .object({ phases: z.array(z.object({ phaseId: z.string() })).optional() })
  .partial();

export interface AssignReviewsToReviewerInput {
  instanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  proposalIds: string[];
}

/**
 * Manually assign a reviewer to proposals in a phase (admin action).
 *
 * Produces rows identical in shape to the automatic phase-advancement path
 * (`generateReviewAssignments`): each assignment carries the proposal history
 * snapshot captured by the most recent transition into the phase, when one
 * exists (reviewer UI falls back to the live proposal otherwise). Reviewers
 * are never assigned their own proposals; existing assignments are left
 * untouched via `onConflictDoNothing`.
 *
 * Assignments are rejected for completed phases (any phase ordered before the
 * instance's current phase).
 *
 * Returns the number of assignments created.
 */
export async function assignReviewsToReviewer({
  instanceId,
  phaseId,
  reviewerProfileId,
  proposalIds,
}: AssignReviewsToReviewerInput): Promise<number> {
  if (proposalIds.length === 0) {
    throw new ValidationError('No proposals selected');
  }

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: {
      id: true,
      profileId: true,
      currentStateId: true,
      instanceData: true,
    },
  });

  if (!instance) {
    throw new NotFoundError('Decision instance not found');
  }

  // Mirror the automatic path: only members holding the REVIEW capability on
  // the decision profile can be assigned reviews.
  const eligibleReviewerProfileIds = instance.profileId
    ? await getEligibleReviewerProfileIds(instance.profileId)
    : [];

  if (!eligibleReviewerProfileIds.includes(reviewerProfileId)) {
    throw new ValidationError(
      'Reviewer is not eligible to review in this process',
    );
  }

  const parsedPhases = phaseOrderData.safeParse(instance.instanceData);
  const phaseIds = parsedPhases.success
    ? (parsedPhases.data.phases?.map((phase) => phase.phaseId) ?? [])
    : [];
  const currentPhaseIndex = instance.currentStateId
    ? phaseIds.indexOf(instance.currentStateId)
    : -1;
  const targetPhaseIndex = phaseIds.indexOf(phaseId);

  if (
    currentPhaseIndex >= 0 &&
    targetPhaseIndex >= 0 &&
    targetPhaseIndex < currentPhaseIndex
  ) {
    throw new ValidationError('Cannot assign reviews in a completed phase');
  }

  const [selectedProposals, latestTransition] = await Promise.all([
    db
      .select({
        id: proposals.id,
        submittedByProfileId: proposals.submittedByProfileId,
      })
      .from(proposals)
      .where(
        and(
          inArray(proposals.id, proposalIds),
          eq(proposals.processInstanceId, instanceId),
        ),
      ),
    db
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(
        and(
          eq(stateTransitionHistory.processInstanceId, instanceId),
          eq(stateTransitionHistory.toStateId, phaseId),
        ),
      )
      .orderBy(desc(stateTransitionHistory.transitionedAt))
      .limit(1),
  ]);

  if (selectedProposals.length === 0) {
    throw new NotFoundError('No matching proposals in this process');
  }

  const transitionHistoryId = latestTransition[0]?.id;

  const transitionProposalRows = transitionHistoryId
    ? await db
        .select({
          proposalId: decisionTransitionProposals.proposalId,
          proposalHistoryId: decisionTransitionProposals.proposalHistoryId,
        })
        .from(decisionTransitionProposals)
        .where(
          and(
            eq(
              decisionTransitionProposals.transitionHistoryId,
              transitionHistoryId,
            ),
            inArray(decisionTransitionProposals.proposalId, proposalIds),
          ),
        )
    : [];

  const historyByProposalId = new Map(
    transitionProposalRows.map((r) => [r.proposalId, r.proposalHistoryId]),
  );

  const assignmentValues = selectedProposals
    .filter((proposal) => proposal.submittedByProfileId !== reviewerProfileId)
    .map((proposal) => ({
      processInstanceId: instanceId,
      proposalId: proposal.id,
      reviewerProfileId,
      phaseId,
      assignedProposalHistoryId: historyByProposalId.get(proposal.id) ?? null,
    }));

  if (assignmentValues.length === 0) {
    return 0;
  }

  const inserted = await db
    .insert(proposalReviewAssignments)
    .values(assignmentValues)
    .onConflictDoNothing()
    .returning({ id: proposalReviewAssignments.id });

  return inserted.length;
}
