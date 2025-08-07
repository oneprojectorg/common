import { db, eq } from '@op/db/client';
import { proposals } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';

export const getProposal = async ({
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
    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
      with: {
        processInstance: {
          with: {
            process: true,
            owner: true,
          },
        },
        submittedBy: true,
        decisions: {
          with: {
            decidedBy: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    // TODO: Add access control - check if user can view this proposal
    // For now, any authenticated user can view any proposal

    return proposal;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error fetching proposal:', error);
    throw new NotFoundError('Proposal not found');
  }
};