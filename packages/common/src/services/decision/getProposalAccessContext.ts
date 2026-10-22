import { and, db, eq, isNull } from '@op/db/client';

import { NotFoundError, UnauthorizedError } from '../../utils';

export type ProposalAccessContext = {
  proposalId: string;
  processInstanceId: string;
  /** `profileId` is where the grants live; `ownerProfileId` is the org fallback. */
  instance: { profileId: string; ownerProfileId: string | null };
  /** Widened to `string` by `enumToPgEnum`; compare against `ProposalStatus`. */
  status: string | null;
};

/**
 * Deliberately no authorization here: merging gates on admin across both ends,
 * the list gates on read access.
 */
export async function getProposalAccessContext(
  proposalId: string,
): Promise<ProposalAccessContext> {
  const proposal = await db.query.proposals.findFirst({
    // Moderation-detached (CSAM) proposals are invisible to everyone, admins
    // included — the same treatment `getProposal` gives them.
    where: {
      RAW: (table) =>
        and(eq(table.id, proposalId), isNull(table.moderationDetachedAt))!,
    },
    columns: { id: true, processInstanceId: true, status: true },
    with: {
      processInstance: {
        columns: { profileId: true, ownerProfileId: true },
      },
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  if (!proposal.processInstance?.profileId) {
    throw new UnauthorizedError('Decision instance has no associated profile');
  }

  return {
    proposalId: proposal.id,
    processInstanceId: proposal.processInstanceId,
    instance: {
      profileId: proposal.processInstance.profileId,
      ownerProfileId: proposal.processInstance.ownerProfileId,
    },
    status: proposal.status,
  };
}
