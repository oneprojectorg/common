'use client';

import { trpc } from '@op/api/client';
import { useMemo } from 'react';

export interface ReviewerAssignmentsInput {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
}

/** One reviewer's queue in a phase, read by the reviewer page and the reviewer panel. */
export function useReviewerAssignments(input: ReviewerAssignmentsInput) {
  const [data, query] =
    trpc.decision.listReviewerAssignments.useSuspenseInfiniteQuery(input, {
      getNextPageParam: (lastPage) => lastPage.next,
      // An SSR-seeded entry never registers the realtime channel; refetch.
      refetchOnMount: 'always',
    });

  const assignments = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );

  return {
    summary: data.pages[0],
    assignments,
    pagination: {
      fetchNextPage: query.fetchNextPage,
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
    },
  };
}

export type ReviewerAssignmentsPagination = ReturnType<
  typeof useReviewerAssignments
>['pagination'];

export function getReviewerName(reviewer: {
  id: string;
  name: string | null;
  slug: string | null;
}): string {
  return reviewer.name ?? reviewer.slug ?? reviewer.id;
}
