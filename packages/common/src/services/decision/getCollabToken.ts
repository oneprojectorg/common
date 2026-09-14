import { generateCollabToken } from '@op/collab/server';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import { parseProposalData } from './proposalDataSchema';
import { getInstancePhases } from './schemas/instanceData';
import { assertProposalUpdateAccess } from './updateProposal';

/**
 * Mint a Tiptap Cloud collaboration token for one proposal's document.
 *
 * The token is scoped to that document alone and gated by the same rule that
 * guards `updateProposal`, so read/write access over the collaboration socket
 * matches read/write access over the API.
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
      profileId: true,
      status: true,
      proposalData: true,
    },
    with: {
      processInstance: {
        columns: {
          profileId: true,
          currentStateId: true,
          instanceData: true,
        },
      },
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalProfileId);
  }

  const { processInstance } = proposal;

  await assertProposalUpdateAccess({
    user,
    data: {},
    proposal,
    processInstance,
    instancePhases: getInstancePhases(processInstance.instanceData),
  });

  const { collaborationDocId } = parseProposalData(proposal.proposalData);

  if (!collaborationDocId) {
    throw new ValidationError(
      'Proposal does not have a collaboration document',
    );
  }

  return {
    token: generateCollabToken({
      userId: user.id,
      documentName: collaborationDocId,
    }),
  };
};
