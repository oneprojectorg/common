import { db, eq } from '@op/db/client';
import { ProcessInstance, proposals } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getProfileAccessUser } from '../access';

export const deleteProposal = async ({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}) => {
  try {
    const existingProposal = await db._query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
      with: {
        processInstance: true,
        decisions: true,
      },
    });

    if (!existingProposal) {
      throw new NotFoundError('Proposal');
    }

    const processInstance = existingProposal.processInstance as ProcessInstance;
    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // Authorization: owner (individual or org), co-author, or instance admin.
    const [rolesOnOwner, rolesOnProposal, rolesOnInstance] = await Promise.all([
      getProfileAccessUser({
        user: { id: user.id },
        profileId: existingProposal.submittedByProfileId,
      }).then((pu) => pu?.roles ?? []),
      getProfileAccessUser({
        user: { id: user.id },
        profileId: existingProposal.profileId,
      }).then((pu) => pu?.roles ?? []),
      processInstance.profileId
        ? getProfileAccessUser({
            user: { id: user.id },
            profileId: processInstance.profileId,
          }).then((pu) => pu?.roles ?? [])
        : Promise.resolve([]),
    ]);

    assertAccess(
      [{ profile: permission.ADMIN }],
      [...rolesOnOwner, ...rolesOnProposal, ...rolesOnInstance],
    );

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
