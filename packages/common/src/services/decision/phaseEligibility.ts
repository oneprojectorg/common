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
 * Lists drop rejected proposals unless the caller filters by status; "Not
 * advanced" asks for them on its own.
 */
export const excludeRejectedUnlessAsked = (
  t: typeof proposals,
  status: string | undefined,
): SQL | undefined =>
  status === undefined ? ne(t.status, ProposalStatus.REJECTED) : undefined;
