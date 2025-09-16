import { db, eq } from '@op/db/client';
import { organizations, proposals } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export const updateProposalStatus = async ({
  proposalId,
  status,
  user,
}: {
  proposalId: string;
  status: 'approved' | 'rejected';
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get proposal with process instance relationship
    const existingProposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
      with: {
        processInstance: true,
      },
    });

    if (!existingProposal) {
      throw new NotFoundError('Proposal not found');
    }

    const processInstance = existingProposal.processInstance as any;
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

    if (!orgUser) {
      throw new UnauthorizedError('You are not a member of this organization');
    }

    // Assert admin permissions - this will throw if user doesn't have permission
    assertAccess({ decisions: permission.UPDATE }, orgUser.roles || []);

    // Update
    const [updatedProposal] = await db
      .update(proposals)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(proposals.id, proposalId))
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
