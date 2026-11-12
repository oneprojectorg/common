import { type SQL, and, db, eq, exists, sql } from '@op/db/client';
import { type proposalReviewAssignments, proposals } from '@op/db/schema';

import {
  activeProposalPredicate,
  phaseEligiblePredicate,
} from '../phaseEligibility';

/**
 * Review assignments whose proposal is in the phase's pool, as
 * `getProposalIdsForPhase` defines it: phase-eligible and active. Merging,
 * rejecting, deleting and detaching leave the assignment rows in place, so
 * every count or list of assignments filters them here. Omit `phaseId` for
 * every phase.
 *
 * The proposal check has no phase: a merge in a later phase also removes the
 * proposal from earlier phases' rollups.
 */
export const eligibleAssignmentPredicate = (
  t: typeof proposalReviewAssignments,
  {
    processInstanceId,
    phaseId,
  }: { processInstanceId: string; phaseId?: string },
): SQL =>
  and(
    eq(t.processInstanceId, processInstanceId),
    phaseId ? eq(t.phaseId, phaseId) : undefined,
    exists(
      db
        .select({ one: sql`1` })
        .from(proposals)
        .where(
          and(
            eq(proposals.id, t.proposalId),
            eq(proposals.processInstanceId, processInstanceId),
            phaseEligiblePredicate(proposals),
            activeProposalPredicate(proposals),
          ),
        ),
    ),
  )!;

/**
 * One reviewer's queue in one phase. The list and its admin totals share it,
 * so the counts describe exactly the rows the list shows.
 */
export const reviewerQueuePredicate = (
  t: typeof proposalReviewAssignments,
  {
    processInstanceId,
    phaseId,
    reviewerProfileId,
  }: { processInstanceId: string; phaseId: string; reviewerProfileId: string },
): SQL =>
  and(
    eligibleAssignmentPredicate(t, { processInstanceId, phaseId }),
    eq(t.reviewerProfileId, reviewerProfileId),
  )!;
