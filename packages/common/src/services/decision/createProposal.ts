import { db, eq } from '@op/db/client';
import {
  EntityType,
  organizations,
  processInstances,
  profiles,
  proposalAttachments,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';
import { randomUUID } from 'crypto';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getCurrentProfileId, getOrgAccessUser } from '../access';
import { processProposalContent } from './proposalContentProcessor';
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

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.profileId, instance.ownerProfileId),
    });

    const organizationId = org?.id;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

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
      instanceData.currentStateId || instance.currentStateId;

    const currentState = processSchema.states.find(
      (s) => s.id === currentStateId,
    );
    if (!currentState) {
      throw new ValidationError('Invalid state in process instance');
    }

    // Check if proposals are allowed in current state
    if (currentState.config?.allowProposals === false) {
      throw new ValidationError(
        `Proposals are not allowed in the ${currentState.name} state`,
      );
    }

    // TODO: Validate proposal data against processSchema.proposalTemplate
    // This would require JSON Schema validation utilities

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
      // Create a profile for the proposal
      const [proposalProfile] = await tx
        .insert(profiles)
        .values({
          type: EntityType.PROPOSAL,
          name: proposalTitle,
          slug: randomUUID(),
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
      }

      return proposal;
    });

    if (!proposal) {
      throw new CommonError('Failed to create proposal');
    }

    // Process proposal content to replace temporary URLs with permanent ones
    if (data.attachmentIds && data.attachmentIds.length > 0) {
      try {
        await processProposalContent(proposal.id);
      } catch (error) {
        console.error('Error processing proposal content:', error);
        // Don't throw - we don't want to fail proposal creation if URL processing fails
      }
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
