import { and, db, eq, inArray, sql } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  decisionTransitionProposals,
  profileUserToAccessRoles,
  profileUsers,
  proposalReviewAssignments,
  proposals,
  users,
} from '@op/db/schema';

import { CommonError } from '../../utils';
import { decisionPermission } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ReviewsPolicy } from './schemas/types';

export interface GenerateReviewAssignmentsInput {
  instanceId: string;
  phaseId: string;
  selectedProposalIds: string[];
  transitionHistoryId: string;
}

/**
 * Generate review assignment rows for proposals entering a review-capable phase.
 *
 * Only members with the REVIEW capability on the `decisions` access zone are
 * eligible. Reviewers are never assigned their own proposals.
 *
 * Currently supports the `full_coverage` policy (every eligible reviewer is
 * assigned every proposal). Throws for unsupported policies.
 */
export async function generateReviewAssignments({
  instanceId,
  phaseId,
  selectedProposalIds,
  transitionHistoryId,
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
  const reviewsPolicy: ReviewsPolicy | undefined =
    instanceData.config?.reviewsPolicy;

  if (reviewsPolicy && reviewsPolicy !== 'full_coverage') {
    throw new CommonError(
      `Review assignment policy '${reviewsPolicy}' is not implemented`,
    );
  }

  const decisionProfileId = instance.profileId;

  if (!decisionProfileId) {
    console.error(
      `generateReviewAssignments: instance ${instanceId} has no profileId`,
    );
    return;
  }

  const decisionsZone = await db.query.accessZones.findFirst({
    where: { name: 'decisions' },
  });

  if (!decisionsZone) {
    console.error('generateReviewAssignments: decisions access zone not found');
    return;
  }

  const [selectedProposals, reviewerProfileIds, transitionProposalRows] =
    await Promise.all([
      db
        .select({
          id: proposals.id,
          submittedByProfileId: proposals.submittedByProfileId,
        })
        .from(proposals)
        .where(inArray(proposals.id, selectedProposalIds)),

      // profileUsers (decision membership)
      //   → profileUserToAccessRoles (role assignments)
      //   → accessRolePermissionsOnAccessZones (zone permissions)
      //   → users (personal profileId)
      // Filtered to members with the REVIEW bit on the decisions zone.
      db
        .selectDistinct({ profileId: users.profileId })
        .from(profileUsers)
        .innerJoin(users, eq(profileUsers.authUserId, users.authUserId))
        .innerJoin(
          profileUserToAccessRoles,
          eq(profileUsers.id, profileUserToAccessRoles.profileUserId),
        )
        .innerJoin(
          accessRolePermissionsOnAccessZones,
          and(
            eq(
              profileUserToAccessRoles.accessRoleId,
              accessRolePermissionsOnAccessZones.accessRoleId,
            ),
            eq(
              accessRolePermissionsOnAccessZones.accessZoneId,
              decisionsZone.id,
            ),
          ),
        )
        .where(
          and(
            eq(profileUsers.profileId, decisionProfileId),
            sql`(${accessRolePermissionsOnAccessZones.permission} & ${decisionPermission.REVIEW}) != 0`,
          ),
        )
        .then((rows) =>
          rows.map((r) => r.profileId).filter((id): id is string => id != null),
        ),

      // Look up the proposal history snapshots captured during the phase transition.
      db
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
            inArray(
              decisionTransitionProposals.proposalId,
              selectedProposalIds,
            ),
          ),
        ),
    ]);

  if (reviewerProfileIds.length === 0 || selectedProposals.length === 0) {
    return;
  }

  const historyByProposalId = new Map(
    transitionProposalRows.map((r) => [r.proposalId, r.proposalHistoryId]),
  );

  const assignmentValues = selectedProposals.flatMap((proposal) =>
    reviewerProfileIds
      .filter((profileId) => profileId !== proposal.submittedByProfileId)
      .map((profileId) => ({
        processInstanceId: instanceId,
        proposalId: proposal.id,
        reviewerProfileId: profileId,
        phaseId,
        assignedProposalHistoryId: historyByProposalId.get(proposal.id) ?? null,
      })),
  );

  if (assignmentValues.length > 0) {
    await db
      .insert(proposalReviewAssignments)
      .values(assignmentValues)
      .onConflictDoNothing();
  }
}
