import {
  type TipTapClient,
  type TipTapVersion,
  createTipTapClient,
} from '@op/collab';
import { db } from '@op/db/client';
import type { ProcessInstance, Profile, Proposal } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { parseProposalData } from './proposalDataSchema';

type ProposalWithVersionAccess = Proposal & {
  processInstance: ProcessInstance;
  profile: Profile;
};

export interface ProposalVersionContext {
  proposal: ProposalWithVersionAccess;
  collaborationDocId: string;
  client: TipTapClient;
}

export function sortVersionsDesc(versions: TipTapVersion[]): TipTapVersion[] {
  return [...versions].sort((left, right) => {
    return right.version - left.version;
  });
}

function createConfiguredTipTapClient(): TipTapClient {
  const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
  const secret = process.env.TIPTAP_SECRET;

  if (!appId || !secret) {
    throw new CommonError('TipTap credentials not configured');
  }

  return createTipTapClient({ appId, secret });
}

/**
 * Loads a proposal, confirms the caller can edit it, and resolves the
 * collaboration document metadata needed for version history operations.
 */
export async function getProposalVersionContext({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<ProposalVersionContext> {
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
    await assertInstanceProfileAccess({
      user: { id: user.id },
      instance: proposal.processInstance,
      profilePermissions: { decisions: permission.UPDATE },
      orgFallbackPermissions: [{ decisions: permission.ADMIN }],
    });
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
    client: createConfiguredTipTapClient(),
  };
}
