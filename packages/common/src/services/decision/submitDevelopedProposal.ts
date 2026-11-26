import { and, db, eq } from '@op/db/client';
import { ProposalStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import { assertDevelopedProposalAuthor } from './assertDevelopedProposalAuthor';
import { finalizeProposalSubmission } from './finalizeProposalSubmission';
import { activeProposalPredicate } from './phaseEligibility';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface SubmitDevelopedProposalInput {
  proposalId: string;
}

/**
 * Submits a developed draft proposal. It is gated by the develop rule, not by
 * the Submit permission or the phase submit rule. Also returns the source
 * proposal ids and the instance owner, for analytics.
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

  const { instance, sourceProposalIds } = await assertDevelopedProposalAuthor({
    proposal,
    instance: proposal.processInstance,
    user,
  });

  const submittedProposal = await finalizeProposalSubmission({
    proposal,
    instance: {
      id: instance.id,
      processId: instance.processId,
      profileId: instance.profileId,
    },
    instanceData: instance.instanceData as DecisionInstanceData,
  });

  return {
    proposal: submittedProposal,
    sourceProposalIds,
    processOwnerProfileId: instance.ownerProfileId,
  };
};
