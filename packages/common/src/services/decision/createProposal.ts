import { db } from '@op/db/client';
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
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertInstanceProfileAccess, getCurrentProfileId } from '../access';
import { assertGlobalRole } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';
import { withBoundaryCategoryLabel } from './boundaryCategory';
import { decisionPermission } from './permissions';
import { processProposalContent } from './proposalContentProcessor';
import {
  type ProposalDataInput,
  parseProposalData,
} from './proposalDataSchema';
import type { DecisionInstanceData } from './schemas/instanceData';
import { syncProposalProfileLocation } from './syncProposalProfileLocation';
import { assertInstancePhase } from './utils/instance';
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

  // Verify the process instance exists
  const instance = await db.query.processInstances.findFirst({
    where: { id: data.processInstanceId },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', data.processInstanceId);
  }

  await assertInstanceProfileAccess({
    user: { id: authUserId },
    instance,
    profilePermissions: [
      { profile: permission.ADMIN },
      { decisions: decisionPermission.SUBMIT_PROPOSALS },
    ],
    orgFallbackPermissions: { profile: permission.ADMIN },
  });

  const instanceData = instance.instanceData as DecisionInstanceData;
  const currentPhaseId = instance.currentStateId;

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

  // Capture the phase's `defaults.hidden` rule at creation time. The flag
  // sticks with the proposal through submission, so a draft authored under
  // a hidden-by-default phase remains hidden even if the rule is edited
  // before submit.
  const currentPhase = assertInstancePhase({
    instance: { instanceData },
    phaseId: currentPhaseId,
  });
  const defaultHidden =
    currentPhase.rules?.proposals?.defaults?.hidden === true;

  const parsedProposalData = parseProposalData(data.proposalData);

  // Extract title from proposal data
  const proposalTitle = extractTitleFromProposalData(data.proposalData);

  // Pre-fetch category terms if specified to avoid lookup inside transaction.
  // Include the location's council-district category (if any) so it is linked
  // through the normal category pipeline — no separate boundary-tagging pass.
  // Without a decision profile (legacy instances) the boundary lookup is
  // skipped and only the manual categories pass through.
  const manualCategoryLabels = [...new Set(parsedProposalData.category)];
  const categoryLabels = instance.profileId
    ? await withBoundaryCategoryLabel(manualCategoryLabels, data.proposalData, {
        profileId: instance.profileId,
      })
    : manualCategoryLabels;
  let categoryTermIds: string[] = [];

  if (categoryLabels.length > 0) {
    try {
      const proposalTaxonomy = await db.query.taxonomies.findFirst({
        where: { name: 'proposal' },
        with: { taxonomyTerms: true },
      });

      if (proposalTaxonomy) {
        const labelSet = new Set(categoryLabels);
        const matchedTerms = proposalTaxonomy.taxonomyTerms.filter(
          (term: { label: string }) => labelSet.has(term.label),
        );

        categoryTermIds = matchedTerms.map((term: { id: string }) => term.id);

        const matchedLabels = new Set(
          matchedTerms.map((term: { label: string }) => term.label),
        );

        for (const categoryLabel of categoryLabels) {
          if (!matchedLabels.has(categoryLabel)) {
            logger.warn('No valid proposal taxonomy term found for category', {
              categoryLabel,
            });
          }
        }
      } else {
        for (const categoryLabel of categoryLabels) {
          logger.warn('No valid proposal taxonomy term found for category', {
            categoryLabel,
          });
        }
      }
    } catch (error) {
      logger.error(
        'Error fetching category terms, proceeding without category links',
        { error },
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
          category: categoryLabels.length > 0 ? categoryLabels : undefined,
        },
        submittedByProfileId: profileId,
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
    await syncProposalProfileLocation(
      tx,
      proposalProfile.id,
      data.proposalData,
    );

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

  return createdProposal;
};

// Helper function to extract title from proposal data
const extractTitleFromProposalData = (proposalData: any): string => {
  if (proposalData && typeof proposalData === 'object') {
    return proposalData.title || proposalData.name || `Untitled Proposal`;
  }
  return 'Untitled Proposal';
};
