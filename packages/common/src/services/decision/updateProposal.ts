import { db, eq } from '@op/db/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type Visibility,
  proposalCategories,
  proposals,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { assertUserByAuthId } from '../assert';
import type { ProposalDataInput } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

/**
 * Updates the category link for a proposal
 */
async function updateProposalCategoryLink(
  proposalId: string,
  newCategoryLabel?: string,
): Promise<void> {
  try {
    // Remove existing category links
    await db
      .delete(proposalCategories)
      .where(eq(proposalCategories.proposalId, proposalId));

    // Add new category link if provided
    if (newCategoryLabel?.trim()) {
      // Find the "proposal" taxonomy
      const proposalTaxonomy = await db._query.taxonomies.findFirst({
        where: eq(taxonomies.name, 'proposal'),
      });

      if (!proposalTaxonomy) {
        console.warn('No "proposal" taxonomy found, skipping category linking');
        return;
      }

      // Find the taxonomy term that matches the category label
      const taxonomyTerm = await db._query.taxonomyTerms.findFirst({
        where: eq(taxonomyTerms.label, newCategoryLabel.trim()),
      });

      if (taxonomyTerm) {
        // Create the new link
        await db.insert(proposalCategories).values({
          proposalId,
          taxonomyTermId: taxonomyTerm.id,
        });
      } else {
        console.warn(
          `No taxonomy term found for category: ${newCategoryLabel}`,
        );
      }
    }
  } catch (error) {
    console.error('Error updating proposal category link:', error);
    // Don't throw error as this is not critical for proposal update
  }
}

export interface UpdateProposalInput {
  proposalData?: ProposalDataInput;
  status?: ProposalStatus;
  visibility?: Visibility;
}

export const updateProposal = async ({
  proposalId,
  data,
  user,
}: {
  proposalId: string;
  data: UpdateProposalInput;
  user: User;
}) => {
  try {
    const dbUser = await assertUserByAuthId(user.id);

    if (!dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Check if proposal exists and user has permission to update it
    const existingProposal = await db._query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
      with: {
        processInstance: true,
      },
    });

    if (!existingProposal) {
      throw new NotFoundError('Proposal not found');
    }

    const processInstance = existingProposal.processInstance as ProcessInstance;

    await assertInstanceProfileAccess({
      user: { id: user.id },
      instance: processInstance,
      profilePermissions: { profile: permission.UPDATE },
      orgFallbackPermissions: { decisions: permission.UPDATE },
    });

    // Status and visibility changes require ADMIN
    if (data.status || data.visibility) {
      await assertInstanceProfileAccess({
        user: { id: user.id },
        instance: processInstance,
        profilePermissions: { profile: permission.ADMIN },
        orgFallbackPermissions: { decisions: permission.ADMIN },
      });
    }

    // Validate proposal data against schema if updating proposalData
    if (data.proposalData) {
      const instanceData =
        processInstance.instanceData as DecisionInstanceData | null;

      const proposalTemplate = await resolveProposalTemplate(
        instanceData,
        processInstance.processId,
      );

      if (proposalTemplate) {
        await validateProposalAgainstTemplate(
          proposalTemplate,
          existingProposal.proposalData,
        );
      }
    }

    const [updatedProposal] = await db
      .update(proposals)
      .set({
        ...data,
        lastEditedByProfileId: dbUser.currentProfileId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(proposals.id, proposalId))
      .returning();

    if (!updatedProposal) {
      throw new CommonError('Failed to update proposal');
    }

    // Update category link if proposal data was updated
    if (data.proposalData) {
      const newCategoryLabel = (data.proposalData as any)?.category;
      await updateProposalCategoryLink(proposalId, newCategoryLabel);
    }

    return updatedProposal;
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error updating proposal:', error);
    throw new CommonError('Failed to update proposal');
  }
};
