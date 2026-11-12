import type { DbClient } from '@op/db/client';
import {
  EntityType,
  ProposalStatus,
  Visibility,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
  proposalAttachments,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';

import { CommonError } from '../../utils';
import { invalidateProfileUserAccessCache } from '../access';
import { generateUniqueProfileSlug } from '../profile/utils';
import { processProposalContent } from './proposalContentProcessor';
import type { ProposalDataInput } from './proposalDataSchema';
import { syncProposalProfileLocation } from './syncProposalProfileLocation';

/**
 * Writes a new draft proposal with its profile, owner membership, location,
 * categories and attachments. The caller asserts access and resolves the
 * inputs first.
 */
export const insertProposalDraft = async ({
  db,
  user,
  processInstanceId,
  proposalData,
  attachmentIds,
  proposalTitle,
  categoryLabels,
  categoryTermIds,
  submittedByProfileId,
  adminRoleId,
  defaultHidden,
}: {
  db: DbClient;
  user: User;
  processInstanceId: string;
  proposalData: ProposalDataInput;
  attachmentIds?: string[];
  proposalTitle: string;
  categoryLabels: string[];
  categoryTermIds: string[];
  submittedByProfileId: string;
  adminRoleId: string;
  defaultHidden: boolean;
}) => {
  const authUserId = user.id;

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
      accessRoleId: adminRoleId,
    });

    const proposalId = crypto.randomUUID();
    const collaborationDocId = `proposal-${proposalId}`;

    const [insertedProposal] = await tx
      .insert(proposals)
      .values({
        id: proposalId,
        processInstanceId,
        proposalData: {
          ...proposalData,
          collaborationDocId,
          category: categoryLabels.length > 0 ? categoryLabels : undefined,
        },
        submittedByProfileId,
        profileId: proposalProfile.id,
        status: ProposalStatus.DRAFT,
        ...(defaultHidden ? { visibility: Visibility.HIDDEN } : {}),
      })
      .returning();

    if (!insertedProposal) {
      throw new CommonError('Failed to create proposal');
    }

    // Project the proposal's location onto its profile via the shared
    // locations relation (no bespoke column on the proposal itself).
    await syncProposalProfileLocation(tx, proposalProfile.id, proposalData);

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
    if (attachmentIds && attachmentIds.length > 0) {
      const proposalAttachmentValues = attachmentIds.map((attachmentId) => ({
        proposalId: insertedProposal.id,
        attachmentId: attachmentId,
        uploadedBy: submittedByProfileId,
      }));

      await tx.insert(proposalAttachments).values(proposalAttachmentValues);

      // Process proposal content to replace temporary URLs with permanent ones
      try {
        await processProposalContent({
          db: tx,
          proposalId: insertedProposal.id,
        });
      } catch (error) {
        logger.error('Error processing proposal content', { error });
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

  // The author's cached `user` entry predates this membership.
  await invalidateProfileUserAccessCache({
    authUserId,
    profileId: createdProposal.profileId,
  });

  return createdProposal;
};
