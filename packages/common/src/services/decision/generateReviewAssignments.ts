import { db, eq, inArray } from '@op/db/client';
import {
  profileUsers,
  proposalReviewAssignments,
  proposals,
  users,
} from '@op/db/schema';

import type { DecisionInstanceData } from './schemas/instanceData';
import type { ReviewsPolicy } from './schemas/types';

export interface GenerateReviewAssignmentsInput {
  instanceId: string;
  phaseId: string;
  selectedProposalIds: string[];
}

/**
 * Generate review assignment rows for proposals entering a review-capable phase.
 *
 * Assignment strategy depends on the instance's `reviewsPolicy`:
 * - `full_coverage` — every eligible reviewer is assigned every proposal.
 * - `self_selection` — no upfront assignments; reviewers claim proposals themselves.
 * - `random_assignment` — a random subset of reviewers is assigned per proposal (TODO).
 *
 * Reviewers are never assigned their own proposals.
 */
export async function generateReviewAssignments({
  instanceId,
  phaseId,
  selectedProposalIds,
}: GenerateReviewAssignmentsInput): Promise<void> {
  if (selectedProposalIds.length === 0) {
    return;
  }

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    console.error(
      `generateReviewAssignments: instance ${instanceId} not found`,
    );
    return;
  }

  const instanceData = instance.instanceData as DecisionInstanceData;
  const reviewsPolicy: ReviewsPolicy =
    instanceData.config?.reviewsPolicy ?? 'full_coverage';

  if (reviewsPolicy === 'self_selection') {
    return;
  }

  const decisionProfileId = instance.profileId;

  if (!decisionProfileId) {
    console.error(
      `generateReviewAssignments: instance ${instanceId} has no profileId`,
    );
    return;
  }

  const [selectedProposals, memberPersonalProfileIds] = await Promise.all([
    db
      .select({
        id: proposals.id,
        submittedByProfileId: proposals.submittedByProfileId,
      })
      .from(proposals)
      .where(inArray(proposals.id, selectedProposalIds)),

    // profileUsers (decision membership) → users (via authUserId) → users.profileId (personal profile)
    db
      .selectDistinct({ profileId: users.profileId })
      .from(profileUsers)
      .innerJoin(users, eq(profileUsers.authUserId, users.authUserId))
      .where(eq(profileUsers.profileId, decisionProfileId))
      .then((rows) =>
        rows.map((r) => r.profileId).filter((id): id is string => id != null),
      ),
  ]);

  if (memberPersonalProfileIds.length === 0 || selectedProposals.length === 0) {
    return;
  }

  if (reviewsPolicy === 'full_coverage') {
    const assignmentValues = selectedProposals.flatMap((proposal) =>
      memberPersonalProfileIds
        .filter((profileId) => profileId !== proposal.submittedByProfileId)
        .map((profileId) => ({
          processInstanceId: instanceId,
          proposalId: proposal.id,
          reviewerProfileId: profileId,
          phaseId,
        })),
    );

    if (assignmentValues.length > 0) {
      await db
        .insert(proposalReviewAssignments)
        .values(assignmentValues)
        .onConflictDoNothing();
    }
  }

  // TODO: random_assignment strategy
}
