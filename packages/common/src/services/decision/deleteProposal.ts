import { db, eq } from '@op/db/client';
import { proposals, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils';

export const deleteProposal = async ({
  proposalId,
  user,
}: {
  proposalId: string;
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

    // Check if proposal exists and user has permission to delete it
    const existingProposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
      with: {
        processInstance: true,
        decisions: true,
      },
    });

    if (!existingProposal) {
      throw new NotFoundError('Proposal not found');
    }

    // Only the submitter or process owner can delete the proposal
    const isSubmitter = existingProposal.submittedByProfileId === dbUser.currentProfileId;
    const processInstance = existingProposal.processInstance as any;
    const isProcessOwner = processInstance?.ownerProfileId === dbUser.currentProfileId;
    
    if (!isSubmitter && !isProcessOwner) {
      throw new UnauthorizedError('Not authorized to delete this proposal');
    }

    // Can only delete proposals in draft or rejected status
    if (!['draft', 'rejected'].includes(existingProposal.status || 'draft')) {
      throw new ValidationError(
        `Cannot delete proposal in ${existingProposal.status} status. Only draft or rejected proposals can be deleted.`
      );
    }

    // Check if there are any decisions on this proposal
    if (existingProposal.decisions && existingProposal.decisions.length > 0) {
      throw new ValidationError(
        'Cannot delete proposal that has received decisions'
      );
    }

    const [deletedProposal] = await db
      .delete(proposals)
      .where(eq(proposals.id, proposalId))
      .returning();

    if (!deletedProposal) {
      throw new CommonError('Failed to delete proposal');
    }

    return { success: true, deletedId: proposalId };
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error deleting proposal:', error);
    throw new CommonError('Failed to delete proposal');
  }
};