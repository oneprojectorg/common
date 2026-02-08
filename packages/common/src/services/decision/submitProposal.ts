import { db, eq } from '@op/db/client';
import { type ProcessInstance, ProposalStatus, proposals } from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { assertOrganizationByProfileId } from '../assert';
import type { DecisionInstanceData } from './schemas/instanceData';
import { checkProposalsAllowed } from './utils/proposal';

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

  // Authorization check
  const org = await assertOrganizationByProfileId(instance.ownerProfileId);
  const organizationId = org.id;

  const orgUser = await getOrgAccessUser({
    user: { id: authUserId },
    organizationId,
  });

  assertAccess({ decisions: permission.UPDATE }, orgUser?.roles ?? []);

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
