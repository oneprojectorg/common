'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { usePostHog } from 'posthog-js/react';
import { type ReactNode, Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ReviewsPanel } from '../ReviewsPanel/ReviewsPanel';
import { useReviewForm } from './ReviewFormContext';

const MY_REVIEW_TAB = 'my-review';
const OTHER_REVIEWS_TAB = 'other-reviews';
const PHASE_TAB_PREFIX = 'phase-reviews-';

/** An earlier review phase whose `openReviews` keeps its reviews readable here. */
export interface PreviousReviewPhase {
  id: string;
  name: string;
}

/**
 * Tab shell for the "Review Proposal" panel:
 *
 * - "My review" — the reviewer's own form. Force-mounted so the form
 *   (autosave, submit, and revision flows) keeps its state while the reviewer
 *   browses the other tabs.
 * - "Other reviews" — the current phase's submitted reviews with the viewer's
 *   own excluded; rendered only when the current phase has open reviews.
 * - "Reviews from {phase}" — one per earlier open review phase. These are a
 *   historical record, so the viewer's own review (if any) is included.
 *
 * Every panel except "My review" mounts lazily, so its aggregates query only
 * runs once the reviewer opens the tab.
 */
export function ReviewTabs({
  myReview,
  showOtherReviews,
  previousPhases,
}: {
  myReview: ReactNode;
  showOtherReviews: boolean;
  previousPhases: PreviousReviewPhase[];
}) {
  const t = useTranslations();
  const { assignment } = useReviewForm();
  const posthog = usePostHog();

  return (
    <Tabs
      defaultSelectedKey={MY_REVIEW_TAB}
      onSelectionChange={(key) => {
        // One event covers every tab, split by `tab`: the reviewer's own form,
        // the current phase's "Other reviews", and the previous-phase
        // "Reviews from {phase}" tabs.
        const isPreviousPhase =
          key !== MY_REVIEW_TAB && key !== OTHER_REVIEWS_TAB;
        posthog.capture(
          'review_tab_opened',
          getDecisionCommonProperties({
            decisionInstanceId: assignment.processInstanceId,
            proposalId: assignment.proposal.id,
            additionalProps: {
              tab:
                key === MY_REVIEW_TAB
                  ? 'my_review'
                  : key === OTHER_REVIEWS_TAB
                    ? 'other_reviews'
                    : 'previous_phase',
              phase_id: isPreviousPhase
                ? String(key).slice(PHASE_TAB_PREFIX.length)
                : assignment.phaseId,
            },
          }),
        );
      }}
    >
      <TabList aria-label={t('Review Proposal')}>
        <Tab id={MY_REVIEW_TAB}>{t('My review')}</Tab>
        {showOtherReviews ? (
          <Tab id={OTHER_REVIEWS_TAB}>{t('Other reviews')}</Tab>
        ) : null}
        {previousPhases.map((phase) => (
          <Tab key={phase.id} id={`${PHASE_TAB_PREFIX}${phase.id}`}>
            {t('Reviews from {phase}', { phase: phase.name })}
          </Tab>
        ))}
      </TabList>

      {/* Force-mounted panels only get an `inert` attribute from React Aria
          when unselected — no visual hiding — so hide it explicitly or the
          form stays stacked above the selected tab's content. */}
      <TabPanel
        id={MY_REVIEW_TAB}
        className="data-[inert]:hidden sm:p-0"
        shouldForceMount
      >
        {myReview}
      </TabPanel>

      {showOtherReviews ? (
        <ReviewsTabPanel id={OTHER_REVIEWS_TAB}>
          <PhaseReviews
            phaseId={assignment.phaseId}
            excludeOwnReview
            emptyMessage={t('No other reviews yet')}
          />
        </ReviewsTabPanel>
      ) : null}

      {previousPhases.map((phase) => (
        <ReviewsTabPanel key={phase.id} id={`${PHASE_TAB_PREFIX}${phase.id}`}>
          <PhaseReviews
            phaseId={phase.id}
            emptyMessage={t('No reviews were submitted in this phase')}
          />
        </ReviewsTabPanel>
      ))}
    </Tabs>
  );
}

/** Lazily mounted reviews panel with its own error boundary + suspense fallback. */
function ReviewsTabPanel({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const t = useTranslations();

  return (
    <TabPanel id={id} className="sm:p-0">
      <APIErrorBoundary
        fallbacks={{
          default: () => (
            <p className="py-8 text-center text-base text-neutral-gray4">
              {t('Failed to load reviews')}
            </p>
          ),
        }}
      >
        <Suspense fallback={<PhaseReviewsSkeleton />}>{children}</Suspense>
      </APIErrorBoundary>
    </TabPanel>
  );
}

/**
 * One phase's submitted reviews for this proposal (average bar, recommendation
 * groups, drill-in). `excludeOwnReview` hides the viewer's own review — used by
 * the current phase's "Other reviews" tab; earlier phases show the full record.
 */
function PhaseReviews({
  phaseId,
  emptyMessage,
  excludeOwnReview = false,
}: {
  phaseId: string;
  emptyMessage: string;
  excludeOwnReview?: boolean;
}) {
  const { assignment } = useReviewForm();
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
          decisionInstanceId: assignment.processInstanceId,
          proposalId: assignment.proposal.id,
          additionalProps: {
            phase_id: phaseId,
            phase_kind: phaseId === assignment.phaseId ? 'current' : 'previous',
            review_assignment_id: reviewAssignmentId,
          },
        }),
      );
    }
    setSelectedAssignmentId(reviewAssignmentId);
  };

  const [proposalWithReviews] =
    trpc.decision.getProposalWithReviewAggregates.useSuspenseQuery({
      processInstanceId: assignment.processInstanceId,
      proposalId: assignment.proposal.id,
      phaseId,
    });

  const visibleReviews = excludeProfileId
    ? proposalWithReviews.reviews.filter(
        (review) => review.reviewer.id !== excludeProfileId,
      )
    : proposalWithReviews.reviews;

  if (visibleReviews.length === 0) {
    return (
      <p className="py-8 text-center text-base text-neutral-gray4">
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

function PhaseReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
