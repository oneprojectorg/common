import { generateCollabToken } from '@op/collab/server';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { parseProposalData } from './proposalDataSchema';

/**
 * Generate a scoped Tiptap Cloud collaboration JWT for a proposal.
 *
 * Verifies the user has UPDATE access on the proposal's profile (with
 * org-level fallback) before issuing the token. The JWT is scoped to the
 * proposal's `collaborationDocId` so users can only access that document.
 *
 * @param proposalProfileId - The proposal's profile ID
 * @param user - The authenticated user
 * @returns An object containing the signed JWT token
 */
export const getCollabToken = async ({
  proposalProfileId,
  user,
}: {
  proposalProfileId: string;
  user: User;
}): Promise<{ token: string }> => {
  const proposal = await db.query.proposals.findFirst({
    where: { profileId: proposalProfileId },
    columns: {
      id: true,
      proposalData: true,
      profileId: true,
    },
    with: {
      processInstance: true,
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  await assertInstanceProfileAccess({
    user: { id: user.id },
    instance: proposal.processInstance,
    profilePermissions: { profile: permission.UPDATE },
    orgFallbackPermissions: { decisions: permission.UPDATE },
  });

  const { collaborationDocId } = parseProposalData(proposal.proposalData);

  if (!collaborationDocId) {
    throw new ValidationError(
      'Proposal does not have a collaboration document',
    );
  }

  const token = generateCollabToken(user.id, [collaborationDocId]);

  return { token };
};
