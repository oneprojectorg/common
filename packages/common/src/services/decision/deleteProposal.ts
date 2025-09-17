import { db, eq } from '@op/db/client';
import { ProcessInstance, organizations, proposals } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getOrgAccessUser, getUserSession } from '../access';

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
    const [sessionUser, existingProposal] = await Promise.all([
      getUserSession({ authUserId: user.id }),
      db.query.proposals.findFirst({
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

    // Get organization from process instance owner profile
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.profileId, processInstance.ownerProfileId),
    });

    if (!organization) {
      throw new UnauthorizedError('Process not owned by an organization');
    }

    // Get user's organization membership and roles
    const orgUser = await getOrgAccessUser({
      user,
      organizationId: organization.id,
    });

    const hasPermissions = checkPermission(
      { decisions: permission.ADMIN },
      orgUser?.roles ?? [],
    );

    // Only the submitter or process owner can delete the proposal
    const isSubmitter =
      existingProposal.submittedByProfileId === dbUser.currentProfileId;
    const isProcessOwner =
      processInstance?.ownerProfileId === dbUser.currentProfileId;

    if (!isSubmitter && !hasPermissions && !isProcessOwner) {
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
