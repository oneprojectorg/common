'use client';

import { trpc } from '@op/api/client';
import { skipToken } from '@tanstack/react-query';

import { useBallotReceipt } from './ballotReceiptStore';

export interface CastBallot {
  /** In rank order when `ranked`, otherwise in the order they were cast. */
  proposalIds: string[];
  ranked: boolean;
}

/**
 * The picks the current profile cast on `instanceId`, for screens that mark
 * the voted proposals without suspending on them.
 *
 * A ballot cast before votes were unlinked still comes with the voting
 * status. One cast since is read with the receipt this browser holds, on
 * the client only, so the server render and a browser without the receipt
 * see an empty ballot. `undefined` until the status has loaded.
 */
export function useCastBallot(instanceId: string): CastBallot | undefined {
  const receiptState = useBallotReceipt(instanceId);
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery({
    processInstanceId: instanceId,
  });
  const linked = voteStatus?.voteSubmission;
  const unlinked = !!linked && linked.selectedProposalIds.length === 0;
  const { data: ballot } = trpc.decision.getBallot.useQuery(
    unlinked && receiptState.status === 'held'
      ? { processInstanceId: instanceId, receipt: receiptState.receipt }
      : skipToken,
  );

  if (!linked) {
    return undefined;
  }

  if (linked.selectedProposalIds.length > 0) {
    return { proposalIds: linked.selectedProposalIds, ranked: linked.ranked };
  }

  return ballot ?? { proposalIds: [], ranked: linked.ranked };
}
