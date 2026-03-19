import { type TipTapClient, getTipTapClient } from '@op/collab';
import { db } from '@op/db/client';
import type { ProcessInstance, Profile, Proposal } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { getProposalFragmentNames } from './getProposalFragmentNames';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';

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

type ProposalWithVersionAccess = Proposal & {
  processInstance: ProcessInstance;
  profile: Profile;
};

/** Full context required by restore / get-version operations. */
export interface ProposalVersionContext {
  proposal: ProposalWithVersionAccess;
  collaborationDocId: string;
  fragmentNames: string[];
  proposalTemplate: ProposalTemplateSchema | null;
  currentProfileId: string;
  client: TipTapClient;
}

/**
 * Loads a proposal, confirms the caller has edit-level access, and resolves
 * all collaboration metadata required for restore / preview operations.
 *
 * Uses the same two-tier permission model as `updateProposal`:
 * 1. Check profile-level `UPDATE` on the proposal's own profile.
 * 2. Fall back to instance-level `decisions:UPDATE` (with org admin fallback).
 */
export async function assertProposalVersionContext({
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

  // Two-tier permission check — same as updateProposal
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

  const proposalTemplate = await resolveProposalTemplate(
    proposal.processInstance.instanceData as DecisionInstanceData | null,
    proposal.processInstance.processId,
  );

  return {
    proposal,
    collaborationDocId: parsedProposalData.collaborationDocId,
    fragmentNames: proposalTemplate
      ? getProposalFragmentNames(proposalTemplate)
      : ['default'],
    proposalTemplate,
    currentProfileId: dbUser.currentProfileId,
    client: getTipTapClient(),
  };
}
