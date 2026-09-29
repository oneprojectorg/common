'use client';
import { useTRPC } from '@op/api/client';
import type { ProposalReviewAggregates } from '@op/common/client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

type Reviewers = ProposalReviewAggregates['reviewers'];

/** Per-proposal reviewers behind the review-count label on assignment cards. */
export function useReviewersByProposalId({
  processInstanceId,
  proposalIds,
  phaseId,
  enabled,
}: {
  processInstanceId: string;
  proposalIds: string[];
  phaseId?: string;
  enabled: boolean;
}): Map<string, Reviewers> {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.decision.listWithReviewAggregates.queryOptions(
      { processInstanceId, phaseId, proposalIds },
      { enabled: enabled && proposalIds.length > 0 },
    ),
  );
  const aggregates = data?.items;

  return useMemo(
    () =>
      new Map(
        (aggregates ?? []).map((item) => [
          item.proposal.id,
          item.aggregates.reviewers,
        ]),
      ),
    [aggregates],
  );
}
