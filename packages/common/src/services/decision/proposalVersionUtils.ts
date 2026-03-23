import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { parseProposalData } from './proposalDataSchema';

/**
 * Loads a proposal, confirms the caller can edit it, and resolves the
 * collaboration document metadata needed for version history operations.
 */
export async function assertProposalVersionPermissions({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<{ collaborationDocId: string }> {
  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal');
  }

  const proposalProfileUser = await getProfileAccessUser({
    user: { id: user.id },
    profileId: proposal.profileId,
  });

  assertAccess(
    [{ profile: permission.UPDATE }, { profile: permission.ADMIN }],
    proposalProfileUser?.roles ?? [],
  );

  const parsedProposalData = parseProposalData(proposal.proposalData);

  if (!parsedProposalData.collaborationDocId) {
    throw new ValidationError(
      'Proposal does not have collaborative content to version',
    );
  }

  return {
    collaborationDocId: parsedProposalData.collaborationDocId,
  };
}
