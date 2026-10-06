import { parseDehydratedState } from '@op/api/dehydratedState';
import type { ReviewSettings } from '@op/common/client';
import { HydrationBoundary } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ReviewSummaryView } from './ReviewSummaryView';

export interface ReviewSummaryLayoutProps {
  decisionSlug: string;
  instanceId: string;
  proposalId: string;
  proposalProfileId: string;
  phaseId: string;
  isPhaseInProgress: boolean;
  reviewSettings: ReviewSettings;
  /** The aggregates and assignments read on the server. */
  dehydratedState: string;
}

/** The admin "Review Progress" summary. Its data comes from `loadReviewSummary`. */
export function ReviewSummaryLayout({
  dehydratedState,
  ...viewProps
}: ReviewSummaryLayoutProps) {
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

  return (
    <HydrationBoundary state={hydrationState}>
      <ReviewSummaryView {...viewProps} />
    </HydrationBoundary>
  );
}
