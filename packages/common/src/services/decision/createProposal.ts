import { db, eq } from '@op/db/client';
import {
  EntityType,
  processInstances,
  profiles,
  proposalAttachments,
  proposalCategories,
  proposals,
  taxonomyTerms,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
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
  user,
}: {
  data: CreateProposalInput;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  // TODO: assert decisions access

  try {
    // Get the database user record to access currentProfileId
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authUserId, data.authUserId),
    });

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

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
          submittedByProfileId: dbUser.currentProfileId!,
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
            uploadedBy: dbUser.currentProfileId!,
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
