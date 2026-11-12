import { and, countDistinct, db, eq, inArray, sql } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { eligibleAssignmentPredicate } from './reviews/assignmentEligibility';
import type { InstancePhaseRef } from './schemas/instance';
import type { PhaseInstanceData } from './schemas/instanceData';
import type { PhaseReviewProgress } from './schemas/reviews';
import { assertInstancePhase } from './utils/instance';

const ACTIVE_ASSIGNMENT_STATUSES = Object.values(
  ProposalReviewAssignmentStatus,
).filter((status) => status !== ProposalReviewAssignmentStatus.PENDING);

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export async function getPhaseReviewProgress(
  input: InstancePhaseRef & { user: User },
): Promise<PhaseReviewProgress> {
  const { user, processInstanceId, phaseId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Ahead of `assertInstancePhase` so an unauthorized caller can't probe which
  // phases the instance has.
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  const [phaseProposalIds, assignedReviewerCounts, reviewedProposalsCount] =
    await Promise.all([
      getProposalIdsForPhase({ instance, phaseId }),
      getAssignedReviewerCounts({ processInstanceId, phaseId }),
      getReviewedProposalsCount({ processInstanceId, phaseId }),
    ]);

  return {
    proposalsReviewedCount: reviewedProposalsCount,
    proposalsTotalCount: phaseProposalIds.length,
    activeReviewersCount: assignedReviewerCounts.active,
    reviewersTotalCount: assignedReviewerCounts.total,
    daysLeft: computeDaysLeft({
      phaseId,
      phases: instance.instanceData.phases,
    }),
  };
}

// Counts distinct reviewers from `proposalReviewAssignments` rows for this
// instance/phase — i.e. reviewers who actually have an assignment, not
// users with the reviewer role. Merged-away proposals are out of the set.
async function getAssignedReviewerCounts({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string;
}): Promise<{ total: number; active: number }> {
  const [row] = await db
    .select({
      total: countDistinct(proposalReviewAssignments.reviewerProfileId),
      active:
        sql<number>`count(distinct ${proposalReviewAssignments.reviewerProfileId}) filter (where ${inArray(
          proposalReviewAssignments.status,
          ACTIVE_ASSIGNMENT_STATUSES,
        )})`.mapWith(Number),
    })
    .from(proposalReviewAssignments)
    .where(
      eligibleAssignmentPredicate(proposalReviewAssignments, {
        processInstanceId,
        phaseId,
      }),
    );

  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
  };
}

// A proposal counts as reviewed once it has ≥1 COMPLETED eligible
// assignment. Eligible assignments are on the phase's pool, so this shares
// its rule with `proposalsTotalCount`.
async function getReviewedProposalsCount({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string;
}): Promise<number> {
  const [row] = await db
    .select({
      count: countDistinct(proposalReviewAssignments.proposalId),
    })
    .from(proposalReviewAssignments)
    .where(
      and(
        eligibleAssignmentPredicate(proposalReviewAssignments, {
          processInstanceId,
          phaseId,
        }),
        eq(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.COMPLETED,
        ),
      ),
    );

  return row?.count ?? 0;
}

export function computeDaysLeft({
  phaseId,
  phases,
  now = new Date(),
}: {
  phaseId: string;
  phases: ReadonlyArray<Pick<PhaseInstanceData, 'phaseId' | 'endDate'>>;
  now?: Date;
}): number | null {
  const phase = phases.find((p) => p.phaseId === phaseId);
  const endDate = phase?.endDate;
  if (!endDate) {
    return null;
  }
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) {
    return null;
  }
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.ceil(diffMs / MS_PER_DAY);
}
