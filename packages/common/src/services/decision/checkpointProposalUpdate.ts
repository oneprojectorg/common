import { getTipTapClient } from '@op/collab';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { updateProposal, type UpdateProposalInput } from './updateProposal';

/**
 * Explicitly checkpoints a non-draft proposal update against the latest saved
 * TipTap version so proposal history rows point at a concrete collaboration
 * document revision.
 */
export const checkpointProposalUpdate = async ({
  proposalId,
  data,
  user,
}: {
  proposalId: string;
  data: Pick<UpdateProposalInput, 'title' | 'proposalData'>;
  user: User;
}) => {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const existingProposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    with: {
      processInstance: true,
      profile: true,
    },
  });

  if (!existingProposal) {
    throw new NotFoundError('Proposal');
  }

  const proposalProfileUser = await getProfileAccessUser({
    user: { id: user.id },
    profileId: existingProposal.profileId,
  });

  const hasProposalUpdate = checkPermission(
    { profile: permission.UPDATE },
    proposalProfileUser?.roles ?? [],
  );

  if (!hasProposalUpdate) {
    await assertInstanceProfileAccess({
      user: { id: user.id },
      instance: existingProposal.processInstance,
      profilePermissions: { decisions: permission.UPDATE },
      orgFallbackPermissions: [{ decisions: permission.ADMIN }],
    });
  }

  const rawExistingProposalData = existingProposal.proposalData as Record<
    string,
    unknown
  >;
  const collaborationDocId =
    (data.proposalData?.collaborationDocId as string | undefined) ??
    (rawExistingProposalData.collaborationDocId as string | undefined);

  if (!collaborationDocId) {
    throw new ValidationError(
      'Proposal does not have collaborative content to checkpoint',
    );
  }

  const latestVersionId = await getTipTapClient()
    .getLatestVersionId(collaborationDocId)
    .catch((error: unknown) => {
      console.error(
        `[checkpointProposalUpdate] Failed to fetch TipTap version for ${collaborationDocId}:`,
        error,
      );
      return null;
    });
  const storedVersionId = rawExistingProposalData.collaborationDocVersionId;

  const nextProposalData = {
    ...rawExistingProposalData,
    ...(data.proposalData ?? {}),
  };

  if (latestVersionId != null && latestVersionId !== storedVersionId) {
    nextProposalData.collaborationDocVersionId = latestVersionId;
  }

  const titleChanged =
    data.title !== undefined && data.title !== existingProposal.profile.name;
  const proposalDataChanged =
    JSON.stringify(rawExistingProposalData) !== JSON.stringify(nextProposalData);

  if (!titleChanged && !proposalDataChanged) {
    return existingProposal;
  }

  return updateProposal({
    proposalId,
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(proposalDataChanged ? { proposalData: nextProposalData } : {}),
    },
    user,
  });
};
