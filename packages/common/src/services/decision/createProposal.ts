import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProposalStatus,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
  proposalAttachments,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getCurrentProfileId, getProfileAccessUser } from '../access';
import { assertGlobalRole } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';
import { decisionPermission } from './permissions';
import { processProposalContent } from './proposalContentProcessor';
import {
  type ProposalDataInput,
  parseProposalData,
} from './proposalDataSchema';
import type { DecisionInstanceData } from './schemas/instanceData';
import { checkProposalsAllowed } from './utils/proposal';

export interface CreateProposalInput {
  processInstanceId: string;
  proposalData: ProposalDataInput;
  attachmentIds?: string[];
}

export const createProposal = async ({
  data,
  user,
}: {
  data: CreateProposalInput;
  user: User;
}) => {
  const authUserId = user.id;

  try {
    // Verify the process instance exists
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
    });

    if (!instance) {
      throw new NotFoundError('Process instance not found');
    }

    if (!instance.profileId) {
      throw new ValidationError('Process instance has no profile');
    }

    const profileAccessUser = await getProfileAccessUser({
      user: { id: authUserId },
      profileId: instance.profileId,
    });

    if (!profileAccessUser) {
      throw new UnauthorizedError('Not authorized');
    }

    assertAccess(
      [
        { profile: permission.ADMIN },
        { decisions: decisionPermission.SUBMIT_PROPOSALS },
      ],
      profileAccessUser.roles,
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

    const parsedProposalData = parseProposalData(data.proposalData);

    // Extract title from proposal data
    const proposalTitle = extractTitleFromProposalData(data.proposalData);

    // Pre-fetch category terms if specified to avoid lookup inside transaction
    const categoryLabels = parsedProposalData.category;
    const categoryTermIds: string[] = [];

    for (const categoryLabel of categoryLabels) {
      try {
        const taxonomyTerm = await db._query.taxonomyTerms.findFirst({
          where: eq(taxonomyTerms.label, categoryLabel),
          with: {
            taxonomy: true,
          },
        });

        if (taxonomyTerm && taxonomyTerm.taxonomy?.name === 'proposal') {
          categoryTermIds.push(taxonomyTerm.id);
        } else {
          console.warn(
            `No valid proposal taxonomy term found for category: ${categoryLabel}`,
          );
        }
      } catch (error) {
        console.warn(
          `Error fetching category term for category: ${categoryLabel}`,
          error,
        );
      }
    }

    const [profileId, adminRole] = await Promise.all([
      getCurrentProfileId(authUserId),
      assertGlobalRole('Admin'),
    ]);
    const createdProposal = await db.transaction(async (tx) => {
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

      // Add the creator as a profile user with the global Admin role
      const [newProfileUser] = await tx
        .insert(profileUsers)
        .values({
          profileId: proposalProfile.id,
          authUserId,
          email: user.email!,
          isOwner: true,
        })
        .returning();

      if (!newProfileUser) {
        throw new CommonError('Failed to create proposal profile user');
      }

      await tx.insert(profileUserToAccessRoles).values({
        profileUserId: newProfileUser.id,
        accessRoleId: adminRole.id,
      });

      const proposalId = crypto.randomUUID();
      const collaborationDocId = `proposal-${proposalId}`;

      const [insertedProposal] = await tx
        .insert(proposals)
        .values({
          id: proposalId,
          processInstanceId: data.processInstanceId,
          proposalData: {
            ...data.proposalData,
            collaborationDocId,
            category:
              parsedProposalData.category.length > 0
                ? parsedProposalData.category
                : undefined,
          },
          submittedByProfileId: profileId,
          profileId: proposalProfile.id,
          status: ProposalStatus.DRAFT,
        })
        .returning();

      if (!insertedProposal) {
        throw new CommonError('Failed to create proposal');
      }

      // Link to categories within transaction if we have valid terms
      if (categoryTermIds.length > 0) {
        await tx.insert(proposalCategories).values(
          categoryTermIds.map((taxonomyTermId) => ({
            proposalId: insertedProposal.id,
            taxonomyTermId,
          })),
        );
      }

      // Link attachments to proposal if provided
      if (data.attachmentIds && data.attachmentIds.length > 0) {
        const proposalAttachmentValues = data.attachmentIds.map(
          (attachmentId) => ({
            proposalId: insertedProposal.id,
            attachmentId: attachmentId,
            uploadedBy: profileId,
          }),
        );

        await tx.insert(proposalAttachments).values(proposalAttachmentValues);

        // Process proposal content to replace temporary URLs with permanent ones
        try {
          await processProposalContent({
            conn: tx,
            proposalId: insertedProposal.id,
          });
        } catch (error) {
          console.error('Error processing proposal content:', error);
          // Let the transaction roll back on error to maintain data consistency
          throw error;
        }
      }

      const proposal = await tx.query.proposals.findFirst({
        where: { id: insertedProposal.id },
        with: { profile: true },
      });

      if (!proposal) {
        throw new CommonError('Failed to create proposal');
      }

      return proposal;
    });

    return createdProposal;
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
