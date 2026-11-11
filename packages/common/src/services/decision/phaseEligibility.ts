import {
  type SQL,
  and,
  db,
  eq,
  exists,
  isNull,
  notInArray,
  sql,
} from '@op/db/client';
import { type proposalReviewAssignments, proposals } from '@op/db/schema';

import { notSuperseded } from './proposalSupersession';
import {
  PIPELINE_INELIGIBLE_STATUSES,
  VOTING_INELIGIBLE_STATUSES,
} from './votingEligibility';

/**
 * Excludes drafts (never in a phase), rejected proposals, and superseded
 * proposals. Every selection, review, and results path resolves membership
 * through `getProposalsForPhase`, so this is what keeps them out of all of them.
 * A rejected proposal stays readable, but no longer advances, gets reviewed, or
 * is voted on.
 */
export const phaseEligiblePredicate = (t: typeof proposals): SQL =>
  and(
    notInArray(t.status, PIPELINE_INELIGIBLE_STATUSES),
    notSuperseded({
      proposalId: t.id,
      processInstanceId: t.processInstanceId,
    }),
  )!;

/**
 * Excludes deleted and moderation-detached proposals. The SQL twin of
 * `isProposalReachable` in `utils/proposal.ts`.
 */
export const activeProposalPredicate = (t: typeof proposals): SQL =>
  and(isNull(t.deletedAt), isNull(t.moderationDetachedAt))!;

export const votingEligiblePredicate = (t: typeof proposals): SQL =>
  and(
    phaseEligiblePredicate(t),
    notInArray(sql<string>`${t.status}::text`, [...VOTING_INELIGIBLE_STATUSES]),
  )!;

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
export const reviewSetPredicate = (
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
    reviewSetPredicate(t, { processInstanceId, phaseId }),
    eq(t.reviewerProfileId, reviewerProfileId),
  )!;
