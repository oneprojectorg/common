import { type SQL, and, notInArray, sql } from '@op/db/client';
import type { proposals } from '@op/db/schema';

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

export const votingEligiblePredicate = (t: typeof proposals): SQL =>
  and(
    phaseEligiblePredicate(t),
    notInArray(sql<string>`${t.status}::text`, [...VOTING_INELIGIBLE_STATUSES]),
  )!;
