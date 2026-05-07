import { and, countDistinct, db, eq, inArray, sql } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import type { InstancePhaseRef } from './schemas/instance';
import type { PhaseInstanceData } from './schemas/instanceData';
import type { PhaseReviewProgress } from './schemas/reviews';

const ACTIVE_ASSIGNMENT_STATUSES = Object.values(
  ProposalReviewAssignmentStatus,
).filter((status) => status !== ProposalReviewAssignmentStatus.PENDING);

export async function getPhaseReviewProgress(
  input: InstancePhaseRef & { user: User },
): Promise<PhaseReviewProgress> {
  const { user, processInstanceId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.access.admin) {
    throw new UnauthorizedError(
      "You don't have admin access to this process instance",
    );
  }

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  const assignedReviewerCountsPromise = getAssignedReviewerCounts({
    processInstanceId,
    phaseId,
  });
  const phaseProposalIds = await getProposalIdsForPhase({ instance, phaseId });
  const [assignedReviewerCounts, reviewedProposalsCount] = await Promise.all([
    assignedReviewerCountsPromise,
    getReviewedProposalsCount({
      processInstanceId,
      phaseId,
      proposalIds: phaseProposalIds,
    }),
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
// users with the reviewer role.
async function getAssignedReviewerCounts({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
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
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        ...(phaseId ? [eq(proposalReviewAssignments.phaseId, phaseId)] : []),
      ),
    );

  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
  };
}

// A proposal counts as reviewed once it has ≥1 COMPLETED assignment.
// Restricted to `proposalIds` so soft-deleted/draft proposals can't slip
// in via stale assignments.
async function getReviewedProposalsCount({
  processInstanceId,
  phaseId,
  proposalIds,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  proposalIds: string[];
}): Promise<number> {
  if (proposalIds.length === 0) {
    return 0;
  }

  const [row] = await db
    .select({
      count: countDistinct(proposalReviewAssignments.proposalId),
    })
    .from(proposalReviewAssignments)
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        ...(phaseId ? [eq(proposalReviewAssignments.phaseId, phaseId)] : []),
        inArray(proposalReviewAssignments.proposalId, proposalIds),
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
  phaseId: string | undefined;
  phases: ReadonlyArray<Pick<PhaseInstanceData, 'phaseId' | 'endDate'>>;
  now?: Date;
}): number | null {
  if (!phaseId) {
    return null;
  }
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
  return Math.ceil(diffMs / 86_400_000);
}
