import { and, db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, ConflictError, NotFoundError } from '../../utils';
import { assertDevelopedProposalStatusAccess } from './assertDevelopedProposalStatusAccess';
import { activeProposalPredicate } from './phaseEligibility';

export interface UnsubmitDevelopedProposalInput {
  proposalId: string;
}

/** Moves a submitted developed proposal back to draft; only the status changes. */
export const unsubmitDevelopedProposal = async ({
  data,
  user,
}: {
  data: UnsubmitDevelopedProposalInput;
  user: User;
}) => {
  const proposal = await db.query.proposals.findFirst({
    where: {
      RAW: (table) =>
        and(eq(table.id, data.proposalId), activeProposalPredicate(table))!,
    },
    with: {
      processInstance: true,
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', data.proposalId);
  }

  if (proposal.status !== ProposalStatus.SUBMITTED) {
    throw new ConflictError('Only a submitted proposal can be un-advanced');
  }

  await assertDevelopedProposalStatusAccess({
    proposal,
    instance: proposal.processInstance,
    user,
  });

  const [draft] = await db
    .update(proposals)
    .set({ status: ProposalStatus.DRAFT })
    .where(
      and(
        eq(proposals.id, proposal.id),
        eq(proposals.status, ProposalStatus.SUBMITTED),
      ),
    )
    .returning({ id: proposals.id });

  if (!draft) {
    throw new ConflictError('Only a submitted proposal can be un-advanced');
  }

  const updated = await db.query.proposals.findFirst({
    where: { id: draft.id },
    with: { profile: true },
  });

  if (!updated) {
    throw new CommonError('Failed to un-advance proposal');
  }

  return updated;
};
