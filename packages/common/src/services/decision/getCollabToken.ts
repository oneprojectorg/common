import { generateCollabToken } from '@op/collab/server';
import { and, db, eq, isNull } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { parseProposalData } from './proposalDataSchema';
import { getInstancePhases, isLastPhase } from './schemas/instanceData';
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
  // Moderation-detached proposals 404 here exactly as they do in
  // `updateProposal` — a takedown must also close the editing socket.
  const proposal = await db.query.proposals.findFirst({
    where: {
      RAW: (table) =>
        and(
          eq(table.profileId, proposalProfileId),
          isNull(table.moderationDetachedAt),
        )!,
    },
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
  const instancePhases = getInstancePhases(processInstance.instanceData);

  // `updateProposal` closes editing in the results phase before it reaches the
  // shared gate, so the same stop has to be repeated here or the token would
  // outlast the API's own refusal.
  if (isLastPhase(processInstance.currentStateId, instancePhases)) {
    throw new UnauthorizedError(
      'Proposals cannot be edited during the results phase',
    );
  }

  await assertProposalUpdateAccess({
    user,
    data: {},
    proposal,
    processInstance,
    instancePhases,
  });

  const { collaborationDocId } = parseProposalData(proposal.proposalData);

  if (!collaborationDocId) {
    throw new ValidationError(
      'Proposal does not have a collaboration document',
    );
  }

  // Tiptap reads a trailing `*` in `allowedDocumentNames` as a wildcard, so a
  // stored id carrying one would widen the token past this proposal. Document
  // names are otherwise free-form — seeds and playtest kits reuse documents.
  if (collaborationDocId.includes('*')) {
    throw new UnauthorizedError(
      'Proposal has an unusable collaboration document name',
    );
  }

  return {
    token: generateCollabToken({
      userId: user.id,
      documentName: collaborationDocId,
    }),
  };
};
