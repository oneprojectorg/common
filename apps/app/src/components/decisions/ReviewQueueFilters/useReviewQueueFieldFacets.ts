'use client';

import { trpc } from '@op/api/client';
import type { ProposalReviewAssignmentStatus } from '@op/common/client';

import type { FieldFacet, FieldFilters } from './fieldFilterParams';
import { toQueryInput } from './fieldFilterParams';

interface ReviewQueueFieldFacets {
  /** One entry per rubric choice criterion, in rubric order. */
  facets: FieldFacet[];
  /** A refetch is in flight; the counts on screen are for an earlier filter set. */
  isPending: boolean;
}

/**
 * Option counts for the reviewer's own queue, over the same scope the list
 * uses minus pagination and sort.
 *
 * A plain query rather than a suspense one on purpose: the counts decorate the
 * filter sheet, so a slow or failed facet read must leave the queue standing.
 * Missing counts render as absent, not as zero.
 */
export function useReviewQueueFieldFacets({
  processInstanceId,
  phaseId,
  status,
  fieldFilters,
  enabled,
}: {
  processInstanceId: string;
  phaseId: string;
  status: ProposalReviewAssignmentStatus | null;
  fieldFilters: FieldFilters;
  /** False when the phase's rubric offers nothing to filter on. */
  enabled: boolean;
}): ReviewQueueFieldFacets {
  const { data, isFetching } =
    trpc.decision.listReviewAssignmentFieldFacets.useQuery(
      {
        processInstanceId,
        phaseId,
        ...(status ? { status } : {}),
        fieldFilters: toQueryInput(fieldFilters),
      },
      {
        enabled,
        // The previous counts stay on screen while the next set loads, so
        // checking a box doesn't blank every number beside it.
        placeholderData: (previous) => previous,
      },
    );

  return {
    facets: data?.facets ?? [],
    isPending: isFetching,
  };
}
