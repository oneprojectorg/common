import { db, eq } from '@op/db/client';
import {
  type DecisionProcess,
  type ProcessInstance,
  proposalAttachments,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { assertOrganizationByProfileId } from '../assert';
import { processProposalContent } from './proposalContentProcessor';
import { schemaValidator } from './schemaValidator';
import type { InstanceData, ProcessSchema, ProposalData } from './types';

type ProcessInstanceWithProcess = ProcessInstance & {
  process: DecisionProcess;
};

export interface SubmitProposalInput {
  proposalId: string;
  /** Updated proposal data - required fields validated at submit time */
  proposalData: ProposalData;
  attachmentIds?: string[];
}

/**
 * Submits a draft proposal, transitioning it to 'submitted' status.
 * Validates required fields against the process schema before submission.
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
  if (existingProposal.status !== 'draft') {
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

  // Check if proposals are allowed in current state
  const process = instance.process as { processSchema: ProcessSchema };
  const processSchema = process.processSchema;
  const instanceData = instance.instanceData as InstanceData;
  const currentPhaseId = instanceData.currentPhaseId;

  if (!currentPhaseId) {
    throw new ValidationError(
      'Legacy processes are not supported for draft proposal submission',
    );
  }

  const currentState = processSchema.states.find(
    (s) => s.id === currentPhaseId,
  );
  if (!currentState) {
    throw new ValidationError('Invalid state in process instance');
  }

  if (currentState.config?.allowProposals === false) {
    throw new ValidationError(
      `Proposals are not allowed in the ${currentState.name} state`,
    );
  }

  // Validate proposal data against processSchema.proposalTemplate
  if (processSchema.proposalTemplate) {
    schemaValidator.validateProposalData(
      processSchema.proposalTemplate,
      data.proposalData,
    );
  }

  // Pre-fetch category term if specified
  const categoryLabel = (data.proposalData as Record<string, unknown>)
    ?.category as string | undefined;
  let categoryTermId: string | null = null;

  if (categoryLabel?.trim()) {
    const taxonomyTerm = await db.query.taxonomyTerms.findFirst({
      where: eq(taxonomyTerms.label, categoryLabel.trim()),
      with: {
        taxonomy: true,
      },
    });

    if (taxonomyTerm && taxonomyTerm.taxonomy?.name === 'proposal') {
      categoryTermId = taxonomyTerm.id;
    }
  }

  // Update proposal: set status to submitted and update proposalData
  const proposal = await db.transaction(async (tx) => {
    const [updatedProposal] = await tx
      .update(proposals)
      .set({
        proposalData: data.proposalData,
        status: 'submitted',
      })
      .where(eq(proposals.id, data.proposalId))
      .returning();

    if (!updatedProposal) {
      throw new CommonError('Failed to submit proposal');
    }

    // Update category if specified (delete existing, insert new)
    if (categoryTermId) {
      // Delete existing categories for this proposal
      await tx
        .delete(proposalCategories)
        .where(eq(proposalCategories.proposalId, data.proposalId));

      // Insert new category
      await tx.insert(proposalCategories).values({
        proposalId: data.proposalId,
        taxonomyTermId: categoryTermId,
      });
    }

    // Link attachments to proposal if provided
    if (data.attachmentIds && data.attachmentIds.length > 0) {
      // Get submittedByProfileId from existing proposal
      const profileId = existingProposal.submittedByProfileId;

      // Delete existing attachments and re-add (simpler than diffing)
      await tx
        .delete(proposalAttachments)
        .where(eq(proposalAttachments.proposalId, data.proposalId));

      const proposalAttachmentValues = data.attachmentIds.map(
        (attachmentId) => ({
          proposalId: data.proposalId,
          attachmentId: attachmentId,
          uploadedBy: profileId,
        }),
      );

      await tx.insert(proposalAttachments).values(proposalAttachmentValues);

      // Process proposal content to replace temporary URLs with permanent ones
      await processProposalContent({ conn: tx, proposalId: data.proposalId });
    }

    return updatedProposal;
  });

  return proposal;
};
