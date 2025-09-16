import { db, eq } from '@op/db/client';
import {
  organizations,
  processInstances,
  proposalCategories,
  proposals,
  taxonomies,
  taxonomyTerms,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getOrgAccessUser } from '../access';
import { schemaValidator } from './schemaValidator';
import type { ProposalData } from './types';

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
      const proposalTaxonomy = await db.query.taxonomies.findFirst({
        where: eq(taxonomies.name, 'proposal'),
      });

      if (!proposalTaxonomy) {
        console.warn('No "proposal" taxonomy found, skipping category linking');
        return;
      }

      // Find the taxonomy term that matches the category label
      const taxonomyTerm = await db.query.taxonomyTerms.findFirst({
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
  proposalData?: ProposalData;
  status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
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
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get the database user record to access currentProfileId
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authUserId, user.id),
    });

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Check if proposal exists and user has permission to update it
    const existingProposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
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

    // join the process table to the org table via ownerId to get the org id
    const instanceOrg = await db
      .select({
        id: organizations.id,
      })
      .from(organizations)
      .leftJoin(
        processInstances,
        eq(organizations.profileId, processInstances.ownerProfileId),
      )
      .where(eq(processInstances.id, existingProposal.processInstanceId))
      .limit(1);

    if (!instanceOrg[0]) {
      throw new UnauthorizedError('User does not have access to this process');
    }

    const orgUser = await getOrgAccessUser({
      user,
      organizationId: instanceOrg[0].id,
    });

    const hasPermissions = checkPermission(
      { decisions: permission.UPDATE },
      orgUser?.roles ?? [],
    );

    // Only the submitter or process owner can update the proposal
    const isSubmitter =
      existingProposal.submittedByProfileId === dbUser.currentProfileId;
    const processInstance = existingProposal.processInstance as any;
    const canUpdateProposal =
      processInstance?.ownerProfileId === dbUser.currentProfileId ||
      hasPermissions;

    if (!isSubmitter && !canUpdateProposal) {
      throw new UnauthorizedError('Not authorized to update this proposal');
    }

    if (data.status) {
      // Only process editors can approve/reject (NOT proposal OWNER)
      if (['approved', 'rejected'].includes(data.status) && !hasPermissions) {
        throw new UnauthorizedError(
          'Only process owner can approve or reject proposals',
        );
      }
    }

    // Validate proposal data against schema if updating proposalData
    if (data.proposalData && processInstance?.process) {
      const process = processInstance.process as any;
      const processSchema = process.processSchema;

      if (processSchema?.proposalTemplate) {
        schemaValidator.validateProposalData(
          processSchema.proposalTemplate,
          data.proposalData,
        );
      }
    }

    const [updatedProposal] = await db
      .update(proposals)
      .set({
        ...data,
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
