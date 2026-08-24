import { db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import { logger } from '@op/logging';
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
 * Move a proposal to `REJECTED`, for admins of its decision. The reason and the
 * optional note to the author are validated and captured, but NOT yet persisted
 * — where to store them (and who rejected) is the open decision in ONE-931, so
 * for now they're only logged. The status flip is the durable effect.
 *
 * A draft has never been submitted, so there is nothing to reject.
 */
export async function rejectProposal({
  proposalId,
  reason,
  note,
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

  // TODO(ONE-931): persist `reason`, `note`, and the rejecting profile once the
  // storage location is decided. Until then this log line is the only record of
  // the rejection reason, so it stays until persistence lands.
  logger.info('Proposal rejected', {
    proposalId,
    processInstanceId: context.processInstanceId,
    reason,
    hasNote: Boolean(note),
    rejectedByProfileId: dbUser.profileId,
  });

  return {
    processInstanceId: context.processInstanceId,
    proposalId: context.proposalId,
  };
}
