import { db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getProposalAccessContext } from './getProposalAccessContext';
import type { RejectProposalInput } from './schemas/rejectProposal';

export type RejectProposalResult = {
  processInstanceId: string;
  proposalId: string;
};

/**
 * Move a proposal to `REJECTED`, for admins of its decision. Rejection is a
 * pipeline rule, not a visibility one: the proposal stops advancing through
 * phases, stops being reviewed, and stops being votable, but it stays listed
 * and readable by everyone — badged with its status — the same way its detail
 * page always has been.
 *
 * A draft has never been submitted, so there is nothing to reject.
 *
 * Three DB round-trips, matching `mergeProposals`: read the proposal (+ its
 * instance profile), assert admin on that profile, then write. We intentionally
 * do NOT set `lastEditedByProfileId` here — recording who rejected is deferred
 * (ONE-931), and the incidental crumb would cost an extra caller lookup for a
 * value any later edit overwrites.
 */
export async function rejectProposal({
  proposalId,
  user,
}: RejectProposalInput & { user: User }): Promise<RejectProposalResult> {
  const context = await getProposalAccessContext(proposalId);

  await assertProfileAccess({
    user,
    profileId: context.instance.profileId,
    permissions: { decisions: permission.ADMIN },
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
