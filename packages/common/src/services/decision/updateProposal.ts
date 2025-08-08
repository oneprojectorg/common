import { db, eq } from '@op/db/client';
import { proposals, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import type { ProposalData } from './types';

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

    // Only the submitter or process owner can update the proposal
    const isSubmitter = existingProposal.submittedByProfileId === dbUser.currentProfileId;
    const processInstance = existingProposal.processInstance as any;
    const isProcessOwner = processInstance?.ownerProfileId === dbUser.currentProfileId;
    
    if (!isSubmitter && !isProcessOwner) {
      throw new UnauthorizedError('Not authorized to update this proposal');
    }

    // Validate status transitions
    if (data.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['submitted'],
        submitted: ['under_review', 'draft'],
        under_review: ['approved', 'rejected', 'submitted'],
        approved: [], // Final state
        rejected: [], // Final state
      };

      const currentStatus = existingProposal.status || 'draft';
      const allowedTransitions = validTransitions[currentStatus] || [];

      if (!allowedTransitions.includes(data.status)) {
        throw new ValidationError(
          `Cannot transition from ${currentStatus} to ${data.status}`
        );
      }

      // Only process owner can approve/reject
      if (['approved', 'rejected'].includes(data.status) && !isProcessOwner) {
        throw new UnauthorizedError('Only process owner can approve or reject proposals');
      }
    }

    // TODO: Validate proposal data against schema if updating proposalData

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