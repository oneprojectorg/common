import { and, countDistinct, db, eq, inArray, sql } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { UnauthorizedError } from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import {
  type PhaseReviewProgress,
  phaseReviewProgressSchema,
} from './schemas/reviews';

export const getPhaseReviewProgressInputSchema = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.string().optional(),
});

export type GetPhaseReviewProgressInput = z.infer<
  typeof getPhaseReviewProgressInputSchema
>;

/**
 * Statuses that count as "active" for the active-reviewer denominator —
 * anything past PENDING means the reviewer has engaged with their queue.
 */
const ACTIVE_ASSIGNMENT_STATUSES: ProposalReviewAssignmentStatus[] = [
  ProposalReviewAssignmentStatus.IN_PROGRESS,
  ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
  ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
  ProposalReviewAssignmentStatus.COMPLETED,
];

/**
 * Instance-level progress metrics for the admin overview header.
 *
 * Three numerator/denominator pairs computed in a single SQL pass against
 * `decision_proposal_review_assignments`, plus `daysLeft` derived from the
 * current phase's `endDate` in `instanceData`.
 *
 * Phase scoping defaults to `instance.currentStateId` so the admin overview
 * always reflects the live phase. `proposalsTotal` is the count of non-draft
 * proposals visible in that phase (see `getProposalIdsForPhase`).
 *
 * `proposalsReviewed` is the number of phase-scoped proposals where every
 * assignment is COMPLETED. A proposal with zero assignments does not count
 * as reviewed — there is no review work to be done.
 */
export async function getPhaseReviewProgress(
  input: GetPhaseReviewProgressInput & { user: User },
): Promise<PhaseReviewProgress> {
  const { user, processInstanceId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.access.admin) {
    throw new UnauthorizedError(
      "You don't have admin access to this process instance",
    );
  }

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  const phaseProposalIds = await getProposalIdsForPhase({
    instance,
    phaseId,
  });

  const [reviewerCounts, completedProposalsCount] = await Promise.all([
    getReviewerCounts({ processInstanceId, phaseId }),
    getCompletedProposalsCount({
      processInstanceId,
      phaseId,
      proposalIds: phaseProposalIds,
    }),
  ]);

  return phaseReviewProgressSchema.parse({
    proposalsReviewed: completedProposalsCount,
    proposalsTotal: phaseProposalIds.length,
    activeReviewers: reviewerCounts.active,
    reviewersTotal: reviewerCounts.total,
    daysLeft: computeDaysLeft({
      phaseId,
      phases: instance.instanceData.phases,
    }),
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

function instancePhaseConditions(
  processInstanceId: string,
  phaseId: string | undefined,
) {
  return [
    eq(proposalReviewAssignments.processInstanceId, processInstanceId),
    ...(phaseId ? [eq(proposalReviewAssignments.phaseId, phaseId)] : []),
  ];
}

async function getReviewerCounts({
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
    .where(and(...instancePhaseConditions(processInstanceId, phaseId)));

  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
  };
}

/**
 * Restricted to `proposalIds` so soft-deleted/draft proposals can't slip in
 * via stale assignments. A proposal is "reviewed" iff it has ≥1 assignment
 * AND every one of those assignments is COMPLETED.
 */
async function getCompletedProposalsCount({
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

  const conditions = [
    ...instancePhaseConditions(processInstanceId, phaseId),
    inArray(proposalReviewAssignments.proposalId, proposalIds),
  ];

  const rows = await db
    .select({ proposalId: proposalReviewAssignments.proposalId })
    .from(proposalReviewAssignments)
    .where(and(...conditions))
    .groupBy(proposalReviewAssignments.proposalId)
    .having(
      sql`count(*) = count(*) filter (where ${proposalReviewAssignments.status} = ${ProposalReviewAssignmentStatus.COMPLETED})`,
    );

  return rows.length;
}

/**
 * Days from "now" to the phase's `endDate` (rounded up — a phase ending
 * later today still has 1 day left). Returns `null` if the phase has no
 * end date or has already passed.
 */
export function computeDaysLeft({
  phaseId,
  phases,
  now = new Date(),
}: {
  phaseId: string | undefined;
  phases: ReadonlyArray<{ phaseId: string; endDate?: string }>;
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
