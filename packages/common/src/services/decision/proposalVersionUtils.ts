import { type TipTapVersion } from '@op/collab';
import { db } from '@op/db/client';
import type { ProcessInstance, Profile, Proposal } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { parseProposalData } from './proposalDataSchema';

type ProposalRecordWithVersionAccess = Proposal & {
  processInstance: ProcessInstance;
  profile: Profile;
};

export interface AssertedProposalWithVersionPermissions {
  proposal: ProposalRecordWithVersionAccess;
  collaborationDocId: string;
}

export function sortVersionsDesc(versions: TipTapVersion[]): TipTapVersion[] {
  return [...versions].sort((left, right) => {
    return right.version - left.version;
  });
}

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
}): Promise<AssertedProposalWithVersionPermissions> {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    with: {
      processInstance: true,
      profile: true,
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal');
  }

  const proposalProfileUser = await getProfileAccessUser({
    user: { id: user.id },
    profileId: proposal.profileId,
  });

  const hasProposalUpdate = checkPermission(
    { profile: permission.UPDATE },
    proposalProfileUser?.roles ?? [],
  );

  if (!hasProposalUpdate) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const parsedProposalData = parseProposalData(proposal.proposalData);

  if (!parsedProposalData.collaborationDocId) {
    throw new ValidationError(
      'Proposal does not have collaborative content to version',
    );
  }

  return {
    proposal,
    collaborationDocId: parsedProposalData.collaborationDocId,
  };
}
