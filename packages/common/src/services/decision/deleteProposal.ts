import { and, db, eq, isNull } from '@op/db/client';
import { ProcessInstance, proposals } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getProfileAccessRoles, getUserSession } from '../access';

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
        // A CSAM-detached proposal is treated as not-found here too —
        // stacking soft-delete on top of a moderation takedown would only
        // muddy the audit trail and leak edit knowledge to the caller.
        where: and(
          eq(proposals.id, proposalId),
          isNull(proposals.moderationDetachedAt),
        ),
        with: {
          processInstance: true,
        },
      }),
    ]);

    const { user: dbUser } = sessionUser ?? {};

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    if (!existingProposal) {
      throw new NotFoundError('Proposal', proposalId);
    }

    const processInstance = existingProposal.processInstance as ProcessInstance;
    if (!processInstance) {
      throw new NotFoundError('Process instance');
    }

    // Check permissions on proposal's profile and instance's profile in parallel
    const [proposalRoles, instanceRoles] = await Promise.all([
      getProfileAccessRoles({
        user: { id: user.id },
        profileId: existingProposal.profileId,
      }),
      processInstance.profileId
        ? getProfileAccessRoles({
            user: { id: user.id },
            profileId: processInstance.profileId,
          })
        : [],
    ]);

    const hasProposalAdmin = checkPermission(
      { profile: permission.ADMIN },
      proposalRoles,
    );

    const hasInstanceAdmin = checkPermission(
      { decisions: permission.ADMIN },
      instanceRoles,
    );

    // Only the submitter, proposal admin, or instance admin can delete
    const isSubmitter =
      existingProposal.submittedByProfileId === dbUser.currentProfileId;

    if (!isSubmitter && !hasProposalAdmin && !hasInstanceAdmin) {
      throw new UnauthorizedError('Not authorized to delete this proposal');
    }

    const [deletedProposal] = await db
      .delete(proposals)
      .where(eq(proposals.id, proposalId))
      .returning();

    if (!deletedProposal) {
      throw new CommonError('Failed to delete proposal');
    }

    console.log('DELETED PROPOSAL', deletedProposal.id, user.id);

    return {
      deletedId: proposalId,
      processInstanceId: deletedProposal.processInstanceId,
    };
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
