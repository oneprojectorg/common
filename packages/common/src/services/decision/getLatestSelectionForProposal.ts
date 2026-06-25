import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import type { ProposalSelection } from './schemas/selection';

/**
 * Returns the proposal's selection record (allocation + rank) from the latest
 * successful result run on the parent process instance, or `null` if no
 * successful result exists or the proposal isn't in it.
 *
 * Callers are responsible for deciding *when* it's meaningful to fetch this —
 * the "latest" row is only unambiguous once the instance has confirmed
 * selections (see `selectionsAreConfirmed`).
 */
export const getLatestSelectionForProposal = async ({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User | undefined;
}): Promise<ProposalSelection | null> => {
  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    columns: { id: true, processInstanceId: true },
    with: {
      processInstance: true,
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  await assertInstanceProfileAccess({
    user,
    instance: proposal.processInstance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [
      { decisions: permission.READ },
      { decisions: permission.ADMIN },
    ],
  });

  const latestResult = await db.query.decisionProcessResults.findFirst({
    where: { processInstanceId: proposal.processInstanceId },
    orderBy: (table, { desc }) => [desc(table.executedAt)],
    columns: { id: true, success: true },
  });

  if (!latestResult?.success) {
    return null;
  }

  const selection = await db.query.decisionProcessResultSelections.findFirst({
    where: {
      processResultId: latestResult.id,
      proposalId,
    },
    columns: { allocated: true, selectionRank: true },
  });

  if (!selection) {
    return null;
  }

  return {
    proposalId,
    allocated: selection.allocated,
    selectionRank: selection.selectionRank,
  };
};
