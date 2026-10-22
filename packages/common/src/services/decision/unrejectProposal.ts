import { and, db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { ConflictError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getProposalAccessContext } from './getProposalAccessContext';
import type { UnrejectProposalInput } from './schemas/rejectProposal';

export type UnrejectProposalResult = {
  processInstanceId: string;
  proposalId: string;
};

/**
 * Undo {@link rejectProposal}: put a rejected proposal back into the active pool.
 * Admins of the decision only.
 *
 * The prior status isn't stored, so restore lands on `SUBMITTED` — the baseline
 * "in the pool" state and the only status the current flow rejects from. Same
 * three round-trips as reject (read, assert, write). The `WHERE status =
 * REJECTED` re-asserts the guard inside the write so two concurrent undos, or an
 * undo racing an edit, resolve to one success and one conflict instead of
 * silently clobbering a status change.
 */
export async function unrejectProposal({
  proposalId,
  user,
}: UnrejectProposalInput & { user: User }): Promise<UnrejectProposalResult> {
  const context = await getProposalAccessContext(proposalId);

  await assertProfileAccess({
    user,
    profileId: context.instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  if (context.status !== ProposalStatus.REJECTED) {
    throw new ValidationError('Only a rejected proposal can be restored');
  }

  const [updated] = await db
    .update(proposals)
    .set({
      status: ProposalStatus.SUBMITTED,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(proposals.id, proposalId),
        eq(proposals.status, ProposalStatus.REJECTED),
      ),
    )
    .returning({ id: proposals.id });

  if (!updated) {
    throw new ConflictError(
      'This proposal is no longer rejected; refresh and retry',
    );
  }

  return {
    processInstanceId: context.processInstanceId,
    proposalId: context.proposalId,
  };
}
