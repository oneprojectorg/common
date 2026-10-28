import { db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, ValidationError } from '../../utils';
import { getProposalAccessContext } from './getProposalAccessContext';
import { assertDecisionAdmin } from './phaseHelpers';

export type RejectProposalResult = {
  processInstanceId: string;
  proposalId: string;
};

/**
 * Move a proposal to `REJECTED`, for admins of its decision. The proposal
 * stops advancing through phases, being reviewed, and being votable. Lists
 * show it only under "Not advanced" or when filtered by status; its detail
 * page stays readable.
 *
 * A draft has never been submitted, so there is nothing to reject.
 *
 * Three DB round-trips, matching `mergeProposals`: read the proposal (+ its
 * instance profile), assert admin on that profile, then write. We intentionally
 * do NOT set `lastEditedByProfileId` here — recording who rejected is deferred
 * (ONE-931), and the incidental crumb would cost an extra caller lookup for a
 * value any later edit overwrites.
 *
 * The dialog also collects a reason and an optional note. Neither has a column
 * yet, so neither reaches this function — the router carries both to the
 * rejection email instead.
 */
export async function rejectProposal({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<RejectProposalResult> {
  const context = await getProposalAccessContext(proposalId);

  await assertDecisionAdmin({
    user,
    decisionProfileId: context.instance.profileId,
  });

  if (context.status === ProposalStatus.DRAFT) {
    throw new ValidationError('A draft proposal cannot be rejected');
  }

  const [updated] = await db
    .update(proposals)
    .set({
      status: ProposalStatus.REJECTED,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(proposals.id, proposalId))
    .returning({ id: proposals.id });

  if (!updated) {
    throw new CommonError('Failed to reject proposal');
  }

  return {
    processInstanceId: context.processInstanceId,
    proposalId: context.proposalId,
  };
}
