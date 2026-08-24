import { db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, UnauthorizedError, ValidationError } from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { getProposalAccessContext } from './getProposalAccessContext';
import type { RejectProposalInput } from './schemas/rejectProposal';

export type RejectProposalResult = {
  processInstanceId: string;
  proposalId: string;
};

/**
 * Move a proposal to `REJECTED`, for admins of its decision. A rejected proposal
 * drops out of every read — phases, review, voting, and the default proposal
 * list — and only stays visible to admins on the proposal list, the same way a
 * flagged proposal does.
 *
 * A draft has never been submitted, so there is nothing to reject.
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

  const dbUser = await assertUserByAuthId(user.id);
  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const [updated] = await db
    .update(proposals)
    .set({
      status: ProposalStatus.REJECTED,
      lastEditedByProfileId: dbUser.profileId,
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
