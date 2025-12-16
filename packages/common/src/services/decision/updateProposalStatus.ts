import { db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { assertOrganizationByProfileId, assertUserByAuthId } from '../assert';

export const updateProposalStatus = async ({
  profileId,
  status,
  user,
}: {
  profileId: string;
  status: ProposalStatus.APPROVED | ProposalStatus.REJECTED;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Fetch user and proposal in parallel for better performance
    const [dbUser, existingProposal] = await Promise.all([
      assertUserByAuthId(user.id),
      db.query.proposals.findFirst({
        where: eq(proposals.profileId, profileId),
        with: {
          processInstance: true,
        },
      }),
    ]);

    if (!dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    if (!existingProposal) {
      throw new NotFoundError('Proposal not found');
    }

    const processInstance = existingProposal.processInstance as any;
    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // Get organization from process instance owner profile
    const organization = await assertOrganizationByProfileId(
      processInstance.ownerProfileId,
    );

    // Get user's organization membership and roles
    const orgUser = await getOrgAccessUser({
      user,
      organizationId: organization.id,
    });

    if (!orgUser) {
      throw new UnauthorizedError('You are not a member of this organization');
    }

    // Assert admin permissions - this will throw if user doesn't have permission
    assertAccess({ decisions: permission.ADMIN }, orgUser.roles || []);

    // Update
    const [updatedProposal] = await db
      .update(proposals)
      .set({
        status,
        lastEditedByProfileId: dbUser.currentProfileId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(proposals.profileId, profileId))
      .returning();

    if (!updatedProposal) {
      throw new CommonError('Failed to update proposal status');
    }

    return updatedProposal;
  } catch (error) {
    console.error('Error updating proposal status:', error);
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof CommonError
    ) {
      throw error;
    }

    throw new CommonError('Failed to update proposal status');
  }
};
