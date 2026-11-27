import { and, db, eq } from '@op/db/client';
import { ProposalStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import { assertDevelopedProposalStatusAccess } from './assertDevelopedProposalStatusAccess';
import { finalizeProposalSubmission } from './finalizeProposalSubmission';
import { activeProposalPredicate } from './phaseEligibility';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface SubmitDevelopedProposalInput {
  proposalId: string;
}

/**
 * Submits a developed draft proposal. It is gated by the develop rule, not by
 * the Submit permission or the phase submit rule.
 */
export const submitDevelopedProposal = async ({
  data,
  user,
}: {
  data: SubmitDevelopedProposalInput;
  user: User;
}) => {
  const proposal = await db.query.proposals.findFirst({
    where: {
      RAW: (table) =>
        and(eq(table.id, data.proposalId), activeProposalPredicate(table))!,
    },
    with: {
      processInstance: true,
      profile: true,
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', data.proposalId);
  }

  if (proposal.status !== ProposalStatus.DRAFT) {
    throw new ValidationError(
      'Only draft proposals can be submitted. This proposal has already been submitted.',
    );
  }

  const instance = await assertDevelopedProposalStatusAccess({
    proposal,
    instance: proposal.processInstance,
    user,
  });

  return finalizeProposalSubmission({
    proposal,
    instance: {
      id: instance.id,
      processId: instance.processId,
      profileId: instance.profileId,
    },
    instanceData: instance.instanceData as DecisionInstanceData,
  });
};
