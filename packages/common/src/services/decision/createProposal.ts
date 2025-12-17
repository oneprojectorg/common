import { db, eq } from '@op/db/client';
import {
  EntityType,
  processInstances,
  profiles,
  proposalAttachments,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getCurrentProfileId, getOrgAccessUser } from '../access';
import { assertOrganizationByProfileId } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';
import { processProposalContent } from './proposalContentProcessor';
import { schemaValidator } from './schemaValidator';
import type { InstanceData, ProcessSchema, ProposalData } from './types';

export interface CreateProposalInput {
  processInstanceId: string;
  proposalData: ProposalData;
  authUserId: string;
  attachmentIds?: string[];
}

export const createProposal = async ({
  data,
  authUserId,
}: {
  data: CreateProposalInput;
  authUserId: string;
}) => {
  if (!authUserId) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Verify the process instance exists and get the process schema
    const instance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
      with: {
        process: true,
      },
    });

    if (!instance) {
      throw new NotFoundError('Process instance not found');
    }

    // Check if the current state allows proposals
    if (!instance.process) {
      throw new NotFoundError('Process definition not found');
    }

    const org = await assertOrganizationByProfileId(instance.ownerProfileId);
    const organizationId = org.id;

    const orgUser = await getOrgAccessUser({
      user: { id: authUserId },
      organizationId,
    });

    assertAccess({ decisions: permission.UPDATE }, orgUser?.roles ?? []);

    // TODO: why doesn't this get resolved by drizzle
    const process = instance.process as any;
    const processSchema = process.processSchema as ProcessSchema;
    const instanceData = instance.instanceData as InstanceData;
    const currentStateId =
      instanceData.currentPhaseId || instance.currentStateId;

    const currentState = processSchema.states.find(
      (s) => s.id === currentStateId,
    );
    if (!currentState) {
      throw new ValidationError('Invalid state in process instance');
    }

    // Check if proposals are allowed in current state
    if (currentState.config?.proposals?.submit === false) {
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

    // Extract title from proposal data
    const proposalTitle = extractTitleFromProposalData(data.proposalData);

    // Pre-fetch category term if specified to avoid lookup inside transaction
    const categoryLabel = (data.proposalData as any)?.category;
    let categoryTermId: string | null = null;

    if (categoryLabel?.trim()) {
      try {
        const taxonomyTerm = await db.query.taxonomyTerms.findFirst({
          where: eq(taxonomyTerms.label, categoryLabel.trim()),
          with: {
            taxonomy: true,
          },
        });

        if (taxonomyTerm && taxonomyTerm.taxonomy?.name === 'proposal') {
          categoryTermId = taxonomyTerm.id;
        } else {
          console.warn(
            `No valid proposal taxonomy term found for category: ${categoryLabel}`,
          );
        }
      } catch (error) {
        console.warn(
          'Error fetching category term, proceeding without category:',
          error,
        );
      }
    }

    const profileId = await getCurrentProfileId(authUserId);
    const proposal = await db.transaction(async (tx) => {
      const slug = await generateUniqueProfileSlug({
        name: proposalTitle,
        db: tx,
      });
      // Create a profile for the proposal
      const [proposalProfile] = await tx
        .insert(profiles)
        .values({
          type: EntityType.PROPOSAL,
          name: proposalTitle,
          slug,
        })
        .returning();

      if (!proposalProfile) {
        throw new CommonError('Failed to create proposal profile');
      }

      const [proposal] = await tx
        .insert(proposals)
        .values({
          processInstanceId: data.processInstanceId,
          proposalData: data.proposalData,
          submittedByProfileId: profileId,
          profileId: proposalProfile.id,
          status: 'submitted',
        })
        .returning();

      // Link to category within transaction if we have a valid term
      if (proposal && categoryTermId) {
        await tx.insert(proposalCategories).values({
          proposalId: proposal.id,
          taxonomyTermId: categoryTermId,
        });
      }

      // Link attachments to proposal if provided
      if (proposal && data.attachmentIds && data.attachmentIds.length > 0) {
        const proposalAttachmentValues = data.attachmentIds.map(
          (attachmentId) => ({
            proposalId: proposal.id,
            attachmentId: attachmentId,
            uploadedBy: profileId,
          }),
        );

        await tx.insert(proposalAttachments).values(proposalAttachmentValues);

        // Process proposal content to replace temporary URLs with permanent ones
        try {
          await processProposalContent({ conn: tx, proposalId: proposal.id });
        } catch (error) {
          console.error('Error processing proposal content:', error);
          // Let the transaction roll back on error to maintain data consistency
          throw error;
        }
      }

      return proposal;
    });

    if (!proposal) {
      throw new CommonError('Failed to create proposal');
    }

    return proposal;
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error creating proposal:', error);
    throw new CommonError('Failed to create proposal');
  }
};

// Helper function to extract title from proposal data
const extractTitleFromProposalData = (proposalData: any): string => {
  if (proposalData && typeof proposalData === 'object') {
    return proposalData.title || proposalData.name || `Untitled Proposal`;
  }
  return 'Untitled Proposal';
};
