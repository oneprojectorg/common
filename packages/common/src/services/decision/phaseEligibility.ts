import { type SQL, and, ne, notInArray } from '@op/db/client';
import { ProposalStatus, type proposals } from '@op/db/schema';

import { notSuperseded } from './proposalSupersession';
import { PIPELINE_INELIGIBLE_STATUSES } from './votingEligibility';

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
 * Rejected proposals belong under "Not advanced", so other lists drop them
 * unless the caller asked for a status or a fixed set (a ballot, an export).
 */
export const excludeRejectedUnlessAsked = (
  t: typeof proposals,
  { status, isFixedSet }: { status: string | undefined; isFixedSet: boolean },
): SQL | undefined =>
  status === undefined && !isFixedSet
    ? ne(t.status, ProposalStatus.REJECTED)
    : undefined;
