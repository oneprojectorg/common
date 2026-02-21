import { db, eq } from '@op/db/client';
import { ProcessInstance, proposals } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getProfileAccessUser, getUserSession } from '../access';

export const deleteProposal = async ({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}) => {
  try {
    const [sessionUser, existingProposal] = await Promise.all([
      getUserSession({ authUserId: user.id }),
      db._query.proposals.findFirst({
        where: eq(proposals.id, proposalId),
        with: {
          processInstance: true,
          decisions: true,
        },
      }),
    ]);

    const { user: dbUser } = sessionUser ?? {};

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    if (!existingProposal) {
      throw new NotFoundError('Proposal not found');
    }

    const processInstance = existingProposal.processInstance as ProcessInstance;
    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // Check permissions on proposal's profile and instance's profile in parallel
    const [proposalProfileUser, instanceProfileUser] = await Promise.all([
      getProfileAccessUser({
        user: { id: user.id },
        profileId: existingProposal.profileId,
      }),
      processInstance.profileId
        ? getProfileAccessUser({
            user: { id: user.id },
            profileId: processInstance.profileId,
          })
        : undefined,
    ]);

    const hasProposalAdmin = checkPermission(
      { profile: permission.ADMIN },
      proposalProfileUser?.roles ?? [],
    );

    const hasInstanceAdmin = checkPermission(
      { decisions: permission.ADMIN },
      instanceProfileUser?.roles ?? [],
    );

    // Only the submitter, proposal admin, or instance admin can delete
    const isSubmitter =
      existingProposal.submittedByProfileId === dbUser.currentProfileId;

    if (!isSubmitter && !hasProposalAdmin && !hasInstanceAdmin) {
      throw new UnauthorizedError('Not authorized to delete this proposal');
    }

    // Check if there are any decisions on this proposal
    if (existingProposal.decisions && existingProposal.decisions.length > 0) {
      throw new ValidationError(
        'Cannot delete proposal that has received decisions',
      );
    }

    const [deletedProposal] = await db
      .delete(proposals)
      .where(eq(proposals.id, proposalId))
      .returning();

    if (!deletedProposal) {
      throw new CommonError('Failed to delete proposal');
    }

    console.log('DELETED PROPOSAL', deletedProposal.id, user.id);

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
