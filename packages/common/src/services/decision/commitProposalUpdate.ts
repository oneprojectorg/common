import { getTipTapClient } from '@op/collab';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import {
  assertCanUpdateProposal,
  updateProposal,
  type UpdateProposalInput,
} from './updateProposal';

/**
 * Persists an intentional proposal update and stamps the latest saved TipTap
 * version when the proposal has collaborative content with a newer revision.
 */
export const commitProposalUpdate = async ({
  proposalId,
  data,
  user,
}: {
  proposalId: string;
  data: UpdateProposalInput;
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

  await assertCanUpdateProposal({
    proposal: existingProposal,
    data,
    user,
  });

  const rawExistingProposalData = existingProposal.proposalData as Record<
    string,
    unknown
  >;
  const collaborationDocId =
    (data.proposalData?.collaborationDocId as string | undefined) ??
    (rawExistingProposalData.collaborationDocId as string | undefined);

  const nextProposalData =
    data.proposalData || collaborationDocId
      ? {
          ...rawExistingProposalData,
          ...(data.proposalData ?? {}),
        }
      : undefined;

  if (collaborationDocId && nextProposalData) {
    const latestVersionId = await getTipTapClient()
      .getLatestVersionId(collaborationDocId)
      .catch((error: unknown) => {
        console.error(
          `[commitProposalUpdate] Failed to fetch TipTap version for ${collaborationDocId}:`,
          error,
        );
        return null;
      });

    const storedVersionId = rawExistingProposalData.collaborationDocVersionId;

    if (latestVersionId != null && latestVersionId !== storedVersionId) {
      nextProposalData.collaborationDocVersionId = latestVersionId;
    }
  }

  const normalizedData: UpdateProposalInput = {
    ...data,
    ...(nextProposalData ? { proposalData: nextProposalData } : {}),
  };

  const titleChanged =
    normalizedData.title !== undefined &&
    normalizedData.title !== existingProposal.profile.name;
  const statusChanged =
    normalizedData.status !== undefined &&
    normalizedData.status !== existingProposal.status;
  const visibilityChanged =
    normalizedData.visibility !== undefined &&
    normalizedData.visibility !== existingProposal.visibility;
  const proposalDataChanged =
    nextProposalData !== undefined &&
    JSON.stringify(rawExistingProposalData) !== JSON.stringify(nextProposalData);

  if (
    !titleChanged &&
    !statusChanged &&
    !visibilityChanged &&
    !proposalDataChanged
  ) {
    return existingProposal;
  }

  return updateProposal({
    proposalId,
    data: normalizedData,
    user,
  });
};
