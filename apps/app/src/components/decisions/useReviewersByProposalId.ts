'use client';

import { trpc } from '@op/api/client';
import type { ProposalReviewAggregates } from '@op/common/client';
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
  const { data } = trpc.decision.listWithReviewAggregates.useQuery(
    { processInstanceId, phaseId, proposalIds },
    { enabled: enabled && proposalIds.length > 0 },
  );

  return useMemo(
    () =>
      new Map(
        (data?.items ?? []).map((item) => [
          item.proposal.id,
          item.aggregates.reviewers,
        ]),
      ),
    [data],
  );
}
