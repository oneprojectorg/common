'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import { Skeleton } from '@op/sense/Skeleton';
import { TabsContent } from '@op/sense/Tabs';
import { usePostHog } from 'posthog-js/react';
import { type ReactNode, Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ReviewsPanel } from './ReviewsPanel';

interface PhaseReviewsProps {
  processInstanceId: string;
  proposalId: string;
  phaseId: string;
  /** Sets the `phase_kind` of the `review_viewed` event. */
  isCurrentPhase: boolean;
  emptyMessage: string;
  excludeOwnReview?: boolean;
}

/**
 * One phase's submitted reviews for this proposal (average bar, recommendation
 * groups, drill-in). `excludeOwnReview` hides the viewer's own review — used by
 * the current phase's "Other reviews" tab; earlier phases show the full record.
 */
export function PhaseReviews({
  processInstanceId,
  proposalId,
  phaseId,
  isCurrentPhase,
  emptyMessage,
  excludeOwnReview = false,
}: PhaseReviewsProps) {
  const { user } = useUser();
  const posthog = usePostHog();
  const excludeProfileId = excludeOwnReview
    ? (user?.currentProfileId ?? undefined)
    : undefined;

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  const handleSelectAssignment = (reviewAssignmentId: string | null) => {
    // Non-null = drilling into another reviewer's full review; null = back.
    if (reviewAssignmentId !== null) {
      posthog.capture(
        'review_viewed',
        getDecisionCommonProperties({
          decisionInstanceId: processInstanceId,
          proposalId,
          additionalProps: {
            phase_id: phaseId,
            phase_kind: isCurrentPhase ? 'current' : 'previous',
            review_assignment_id: reviewAssignmentId,
          },
        }),
      );
    }
    setSelectedAssignmentId(reviewAssignmentId);
  };

  const [proposalWithReviews] =
    trpc.decision.getProposalWithReviewAggregates.useSuspenseQuery({
      processInstanceId,
      proposalId,
      phaseId,
    });

  const visibleReviews = excludeProfileId
    ? proposalWithReviews.reviews.filter(
        (review) => review.reviewer.id !== excludeProfileId,
      )
    : proposalWithReviews.reviews;

  if (visibleReviews.length === 0) {
    return (
      <p className="py-8 text-center text-base text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ReviewsPanel
      proposalWithReviews={proposalWithReviews}
      rubricTemplate={proposalWithReviews.rubricTemplate}
      selectedAssignmentId={selectedAssignmentId}
      onSelectAssignment={handleSelectAssignment}
      excludeProfileId={excludeProfileId}
      hideSummaryHeader
    />
  );
}

/** Lazily mounted reviews tab panel with its own error boundary + suspense fallback. */
export function PhaseReviewsTabPanel({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const t = useTranslations();

  return (
    <TabsContent value={value}>
      <APIErrorBoundary
        fallbacks={{
          default: () => (
            <p className="py-8 text-center text-base text-muted-foreground">
              {t('decisions.review.loadReviewsError')}
            </p>
          ),
        }}
      >
        <Suspense fallback={<PhaseReviewsSkeleton />}>{children}</Suspense>
      </APIErrorBoundary>
    </TabsContent>
  );
}

function PhaseReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
