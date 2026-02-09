import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProposalStatus,
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
import type { ProposalDataInput } from './proposalDataSchema';
import type { DecisionInstanceData } from './schemas/instanceData';
import { checkProposalsAllowed } from './utils/proposal';

export interface CreateProposalInput {
  processInstanceId: string;
  proposalData: ProposalDataInput;
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
    // Verify the process instance exists
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
    });

    if (!instance) {
      throw new NotFoundError('Process instance not found');
    }

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

    // Extract title from proposal data
    const proposalTitle = extractTitleFromProposalData(data.proposalData);

    // Pre-fetch category term if specified to avoid lookup inside transaction
    const categoryLabel = (data.proposalData as any)?.category;
    let categoryTermId: string | null = null;

    if (categoryLabel?.trim()) {
      try {
        const taxonomyTerm = await db._query.taxonomyTerms.findFirst({
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

      const proposalId = crypto.randomUUID();
      const collaborationDocId = `proposal-${proposalId}`;

      const [proposal] = await tx
        .insert(proposals)
        .values({
          id: proposalId,
          processInstanceId: data.processInstanceId,
          proposalData: {
            ...data.proposalData,
            collaborationDocId,
          },
          submittedByProfileId: profileId,
          profileId: proposalProfile.id,
          status: ProposalStatus.DRAFT,
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
