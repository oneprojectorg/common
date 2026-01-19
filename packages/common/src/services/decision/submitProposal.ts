import { db, eq } from '@op/db/client';
import {
  type DecisionProcess,
  type ProcessInstance,
  ProposalStatus,
  proposals,
} from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { assertOrganizationByProfileId } from '../assert';
import type { DecisionSchemaDefinition } from './schemas';
import type { InstanceData } from './types';
import { checkProposalsAllowed } from './utils/proposal';

type ProcessInstanceWithProcess = ProcessInstance & {
  process: DecisionProcess;
};

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
    where: eq(proposals.id, data.proposalId),
    with: {
      processInstance: {
        with: {
          process: true,
        },
      },
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

  const instance =
    existingProposal.processInstance as ProcessInstanceWithProcess;
  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  if (!instance.process) {
    throw new NotFoundError('Process definition not found');
  }

  // Authorization check
  const org = await assertOrganizationByProfileId(instance.ownerProfileId);
  const organizationId = org.id;

  const orgUser = await getOrgAccessUser({
    user: { id: authUserId },
    organizationId,
  });

  assertAccess({ decisions: permission.UPDATE }, orgUser?.roles ?? []);

  const process = instance.process as {
    processSchema: DecisionSchemaDefinition;
  };
  const processSchema = process.processSchema;
  const instanceData = instance.instanceData as InstanceData;
  const currentPhaseId = instanceData.currentPhaseId;

  if (!currentPhaseId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  // Check if proposals are allowed in current phase
  const { allowed, phaseName } = checkProposalsAllowed(
    processSchema,
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
