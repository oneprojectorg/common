import { db } from '@op/db/client';
import { type ProcessInstance, ProposalStatus } from '@op/db/schema';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { assertProposalsAllowed } from './assertProposalsAllowed';
import { finalizeProposalSubmission } from './finalizeProposalSubmission';
import { getPhases } from './instancePhases';
import { decisionPermission } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface SubmitProposalInput {
  proposalId: string;
}

/**
 * Submits a draft proposal, transitioning it to 'submitted' status.
 */
export const submitProposal = async ({
  data,
  authUserId,
}: {
  data: SubmitProposalInput;
  authUserId: string;
}) => {
  // Fetch the proposal with its process instance
  const existingProposal = await db.query.proposals.findFirst({
    where: { id: data.proposalId },
    with: {
      processInstance: true,
      profile: true,
    },
  });

  if (!existingProposal) {
    throw new NotFoundError('Proposal', data.proposalId);
  }

  // Only allow submitting drafts
  if (existingProposal.status !== ProposalStatus.DRAFT) {
    throw new ValidationError(
      'Only draft proposals can be submitted. This proposal has already been submitted.',
    );
  }

  const instance = existingProposal.processInstance as ProcessInstance;

  if (!instance.profileId) {
    throw new NotFoundError('Decision profile');
  }

  // Authorization check - verify user has access to the decision profile
  await assertProfileAccess({
    user: { id: authUserId },
    profileId: instance.profileId,
    permissions: [
      { profile: permission.ADMIN },
      { decisions: decisionPermission.SUBMIT_PROPOSALS },
    ],
  });

  const instanceData = instance.instanceData as DecisionInstanceData;
  const currentPhaseId = instance.currentStateId;

  if (!currentPhaseId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  assertProposalsAllowed({
    phases: await getPhases({ instance }),
    phaseId: currentPhaseId,
  });

  return finalizeProposalSubmission({
    proposal: existingProposal,
    instance: {
      id: instance.id,
      processId: instance.processId,
      profileId: instance.profileId,
    },
    instanceData,
  });
};
