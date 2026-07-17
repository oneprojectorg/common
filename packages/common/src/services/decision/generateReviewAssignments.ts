import { and, db, eq, inArray } from '@op/db/client';
import {
  decisionTransitionProposals,
  profileUserToAccessRoles,
  profileUsers,
  proposalReviewAssignments,
  proposals,
  users,
} from '@op/db/schema';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import {
  pickEffectivePermissionRows,
  zonePermissionsWhere,
} from '../access/utils';
import { decisionPermission } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface GenerateReviewAssignmentsInput {
  instanceId: string;
  phaseId: string;
  selectedProposalIds: string[];
  transitionHistoryId: string;
}

/**
 * Resolve the personal profile ids of members eligible to review for a
 * decision profile: members holding a role with the REVIEW capability on the
 * `decisions` access zone. Returns [] (and logs) when the zone is missing.
 */
export async function getEligibleReviewerProfileIds(
  decisionProfileId: string,
): Promise<string[]> {
  const decisionsZone = await db.query.accessZones.findFirst({
    where: { name: 'decisions' },
  });

  if (!decisionsZone) {
    logger.error('getEligibleReviewerProfileIds: decisions zone not found');
    return [];
  }

  // Resolve which roles grant REVIEW on the decisions zone for this decision
  // profile. Permission rows are profile-scoped: global rows (profileId IS
  // NULL) are the baseline, and a row scoped to the decision profile OVERRIDES
  // the global one. Candidate roles are the profile's own roles plus global
  // roles — the only ones grantable to its members.
  const zonePermissionRows =
    await db.query.accessRolePermissionsOnAccessZones.findMany({
      where: {
        accessZoneId: decisionsZone.id,
        ...zonePermissionsWhere(decisionProfileId),
        accessRole: {
          OR: [
            { profileId: { isNull: true } },
            { profileId: decisionProfileId },
          ],
        },
      },
      columns: { accessRoleId: true, permission: true, profileId: true },
    });

  const reviewRoleIds = pickEffectivePermissionRows(
    zonePermissionRows,
    (row) => row.accessRoleId,
    decisionProfileId,
  )
    .filter((row) => (row.permission & decisionPermission.REVIEW) !== 0)
    .map((row) => row.accessRoleId);

  if (reviewRoleIds.length === 0) {
    return [];
  }

  // profileUsers (decision membership)
  //   → profileUserToAccessRoles (role assignments)
  //   → users (personal profileId)
  // Filtered to members holding a role with the REVIEW capability.
  const rows = await db
    .selectDistinct({ profileId: users.profileId })
    .from(profileUsers)
    .innerJoin(users, eq(profileUsers.authUserId, users.authUserId))
    .innerJoin(
      profileUserToAccessRoles,
      eq(profileUsers.id, profileUserToAccessRoles.profileUserId),
    )
    .where(
      and(
        eq(profileUsers.profileId, decisionProfileId),
        inArray(profileUserToAccessRoles.accessRoleId, reviewRoleIds),
      ),
    );

  return rows.map((r) => r.profileId).filter((id): id is string => id != null);
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
    throw new CommonError(
      `generateReviewAssignments: instance ${instanceId} not found`,
    );
  }

  const instanceData = instance.instanceData as DecisionInstanceData;
  const reviewsPolicy = instanceData.config?.reviewsPolicy;

  if (reviewsPolicy && reviewsPolicy !== 'full_coverage') {
    throw new CommonError(
      `Review assignment policy '${reviewsPolicy}' is not implemented`,
    );
  }

  const decisionProfileId = instance.profileId;

  if (!decisionProfileId) {
    logger.error('generateReviewAssignments: instance has no profileId', {
      instanceId,
    });
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

      getEligibleReviewerProfileIds(decisionProfileId),

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
      // NOTE: we should revisit this logic when we have multiple authors per proposal
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
