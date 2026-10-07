'use client';
import { useTRPC } from '@op/api/client';
import type { ProposalReviewAssignmentStatus } from '@op/common/client';
import { useSuspenseQuery } from '@tanstack/react-query';

import {
  ProposalsMapView,
  type ProposalsMapViewProps,
} from './ProposalsMapView';

interface ReviewAssignmentLocationFilter {
  processInstanceId: string;
  phaseId: string;
  status?: ProposalReviewAssignmentStatus;
}

type ReviewAssignmentsMapWithLocationsProps = Omit<
  ProposalsMapViewProps,
  'pinProposals'
> & {
  locationFilter: ReviewAssignmentLocationFilter;
};

/**
 * Pin source for the reviewer queue: every located proposal the caller is
 * assigned to review. The queue pages, so the map reads its pins from this
 * separate query rather than from the loaded list pages.
 */
export function ReviewAssignmentsMapWithLocations({
  locationFilter,
  ...props
}: ReviewAssignmentsMapWithLocationsProps) {
  const trpc = useTRPC();
  const {
    data: { items: pinProposals },
  } = useSuspenseQuery(
    trpc.decision.listReviewAssignmentLocations.queryOptions(locationFilter, {
      // A client-side fetch is what registers the realtime invalidation
      // channel, so a cached result must not skip the request on mount.
      refetchOnMount: 'always',
    }),
  );

  return <ProposalsMapView {...props} pinProposals={pinProposals} />;
}
