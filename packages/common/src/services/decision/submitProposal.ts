import { db, eq } from '@op/db/client';
import { type ProcessInstance, ProposalStatus, proposals } from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { decisionPermission } from './permissions';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import { checkProposalsAllowed } from './utils/proposal';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

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
  const existingProposal = await db._query.proposals.findFirst({
    where: eq(proposals.id, data.proposalId),
    with: {
      processInstance: true,
    },
  });

  if (!existingProposal) {
    throw new NotFoundError('Proposal not found');
  }

  // Only allow submitting drafts
  if (existingProposal.status !== ProposalStatus.DRAFT) {
    throw new ValidationError(
      'Only draft proposals can be submitted. This proposal has already been submitted.',
    );
  }

  const instance = existingProposal.processInstance as ProcessInstance;

  if (!instance.profileId) {
    throw new NotFoundError('Decision profile not found');
  }

  // Authorization check - verify user has access to the decision profile
  const profileUser = await getProfileAccessUser({
    user: { id: authUserId },
    profileId: instance.profileId,
  });

  assertAccess(
    [
      { profile: permission.ADMIN },
      { decisions: decisionPermission.SUBMIT_PROPOSALS },
    ],
    profileUser?.roles ?? [],
  );

  const instanceData = instance.instanceData as DecisionInstanceData;
  const currentPhaseId = instanceData.currentPhaseId;

  if (!currentPhaseId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  // Check if proposals are allowed in current phase
  const { allowed, phaseName } = checkProposalsAllowed(
    instanceData.phases,
    currentPhaseId,
  );

  if (!allowed) {
    throw new ValidationError(
      `Proposals are not allowed in the ${phaseName} phase`,
    );
  }

  // Validate proposal data against the proposal template schema
  const proposalTemplate = await resolveProposalTemplate(
    instanceData,
    instance.processId,
  );

  if (proposalTemplate) {
    await validateProposalAgainstTemplate(
      proposalTemplate,
      existingProposal.proposalData,
    );
  }

  // Update proposal status to submitted
  const [updatedProposal] = await db
    .update(proposals)
    .set({
      status: ProposalStatus.SUBMITTED,
    })
    .where(eq(proposals.id, data.proposalId))
    .returning();

  if (!updatedProposal) {
    throw new CommonError('Failed to submit proposal');
  }

  return updatedProposal;
};
