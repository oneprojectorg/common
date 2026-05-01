import { and, db, eq, inArray, sql } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { UnauthorizedError } from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { type ReviewProgress, reviewProgressSchema } from './schemas/reviews';

export const getReviewProgressInputSchema = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.string().optional(),
});

export type GetReviewProgressInput = z.infer<
  typeof getReviewProgressInputSchema
>;

/**
 * Statuses that count as "active" for the active-reviewer denominator —
 * anything past PENDING means the reviewer has engaged with their queue.
 */
const ACTIVE_ASSIGNMENT_STATUSES = [
  ProposalReviewAssignmentStatus.IN_PROGRESS,
  ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
  ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
  ProposalReviewAssignmentStatus.COMPLETED,
] as const;

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
export async function getReviewProgress(
  input: GetReviewProgressInput & { user: User },
): Promise<ReviewProgress> {
  const { user, processInstanceId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.access.admin) {
    throw new UnauthorizedError(
      "You don't have admin access to this process instance",
    );
  }

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  const phaseProposalIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
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

  return reviewProgressSchema.parse({
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

/**
 * Total assigned reviewers and the subset that are "active" (status past
 * PENDING) for a phase — single query, two aggregates.
 */
async function getReviewerCounts({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
}): Promise<{ total: number; active: number }> {
  const conditions = [
    eq(proposalReviewAssignments.processInstanceId, processInstanceId),
  ];
  if (phaseId) {
    conditions.push(eq(proposalReviewAssignments.phaseId, phaseId));
  }

  const activeStatuses = sql.join(
    ACTIVE_ASSIGNMENT_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  );

  const [row] = await db
    .select({
      total: sql<number>`COUNT(DISTINCT ${proposalReviewAssignments.reviewerProfileId})`,
      active: sql<number>`COUNT(DISTINCT CASE WHEN ${proposalReviewAssignments.status} IN (${activeStatuses}) THEN ${proposalReviewAssignments.reviewerProfileId} END)`,
    })
    .from(proposalReviewAssignments)
    .where(and(...conditions));

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
  };
}

/**
 * Count of phase-scoped proposals whose every assignment is COMPLETED.
 *
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
    eq(proposalReviewAssignments.processInstanceId, processInstanceId),
    inArray(proposalReviewAssignments.proposalId, proposalIds),
  ];
  if (phaseId) {
    conditions.push(eq(proposalReviewAssignments.phaseId, phaseId));
  }

  const rows = await db
    .select({ proposalId: proposalReviewAssignments.proposalId })
    .from(proposalReviewAssignments)
    .where(and(...conditions))
    .groupBy(proposalReviewAssignments.proposalId)
    .having(
      sql`COUNT(*) = COUNT(*) FILTER (WHERE ${proposalReviewAssignments.status} = ${ProposalReviewAssignmentStatus.COMPLETED})`,
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
