import { createTipTapClient } from '@op/collab';
import { db, eq } from '@op/db/client';
import { type ProcessInstance, ProposalStatus, proposals } from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';
import type { JSONSchema7 } from 'json-schema';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { assembleProposalData } from './assembleProposalData';
import { getProposalFragmentNames } from './getProposalFragmentNames';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { schemaValidator } from './schemaValidator';
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

  if (!instance.profileId) {
    throw new NotFoundError('Decision profile not found');
  }

  // Authorization check - verify user has access to the decision profile
  const profileUser = await getProfileAccessUser({
    user: { id: authUserId },
    profileId: instance.profileId,
  });

  assertAccess({ decisions: permission.CREATE }, profileUser?.roles ?? []);

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
    const parsed = parseProposalData(existingProposal.proposalData);

    if (parsed.collaborationDocId) {
      // Fetch field values from the Yjs collaboration document
      const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
      const secret = process.env.TIPTAP_SECRET;

      if (!appId || !secret) {
        throw new CommonError(
          'TipTap credentials not configured, cannot validate proposal',
        );
      }

      const client = createTipTapClient({ appId, secret });
      const fragmentNames = getProposalFragmentNames(
        proposalTemplate as Record<string, unknown>,
      );
      const fragmentTexts = await client.getDocumentFragments(
        parsed.collaborationDocId,
        fragmentNames,
        'text',
      );
      const validationData = assembleProposalData(
        proposalTemplate as JSONSchema7,
        fragmentTexts,
      );

      schemaValidator.validateProposalData(
        proposalTemplate as JSONSchema7,
        validationData,
      );
    } else {
      // Legacy proposal without collaboration doc — validate DB data directly
      schemaValidator.validateProposalData(
        proposalTemplate as JSONSchema7,
        existingProposal.proposalData,
      );
    }
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
