import { type SQL, and, notInArray } from '@op/db/client';
import type { proposals } from '@op/db/schema';

import { notSuperseded } from './proposalSupersession';
import { PIPELINE_INELIGIBLE_STATUSES } from './votingEligibility';

/**
 * Excludes drafts (never in a phase), rejected proposals, and superseded
 * proposals. Every selection, review, and results path resolves membership
 * through `getProposalsForPhase`, so this is what keeps them out of all of them. Since the
 * proposal list stopped filtering on rejection (`resolveProposalListScope`),
 * this predicate is the whole of the rejection rule for the pipeline: a
 * rejected proposal is listed and readable by everyone, and what it no longer
 * does is advance, get reviewed, or be voted on.
 */
export const phaseEligiblePredicate = (t: typeof proposals): SQL =>
  and(
    notInArray(t.status, PIPELINE_INELIGIBLE_STATUSES),
    notSuperseded({
      proposalId: t.id,
      processInstanceId: t.processInstanceId,
    }),
  )!;
