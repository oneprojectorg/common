'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { type ReactNode, Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ReviewsPanel } from '../ReviewsPanel/ReviewsPanel';
import { useReviewForm } from './ReviewFormContext';

const MY_REVIEW_TAB = 'my-review';
const OTHER_REVIEWS_TAB = 'other-reviews';

/**
 * Two-tab shell for the "Review Proposal" panel when open reviews are enabled:
 * the reviewer's own form ("My review") and a read-only view of everyone else's
 * submitted reviews ("Other reviews").
 *
 * The "My review" panel is force-mounted so the form (autosave, submit, and
 * revision flows) keeps its state while the reviewer browses other reviews. The
 * "Other reviews" panel mounts lazily, so its aggregates query only runs once
 * the reviewer opens the tab.
 */
export function ReviewTabs({ myReview }: { myReview: ReactNode }) {
  const t = useTranslations();

  return (
    <Tabs defaultSelectedKey={MY_REVIEW_TAB}>
      <TabList aria-label={t('Review Proposal')}>
        <Tab id={MY_REVIEW_TAB}>{t('My review')}</Tab>
        <Tab id={OTHER_REVIEWS_TAB}>{t('Other reviews')}</Tab>
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

      <TabPanel id={OTHER_REVIEWS_TAB} className="sm:p-0">
        <APIErrorBoundary
          fallbacks={{
            default: () => (
              <p className="py-8 text-center text-base text-neutral-gray4">
                {t('Failed to load reviews')}
              </p>
            ),
          }}
        >
          <Suspense fallback={<OtherReviewsSkeleton />}>
            <OtherReviews />
          </Suspense>
        </APIErrorBoundary>
      </TabPanel>
    </Tabs>
  );
}

function OtherReviews() {
  const t = useTranslations();
  const { assignment, rubricTemplate } = useReviewForm();
  const { user } = useUser();
  const excludeProfileId = user?.currentProfileId ?? undefined;

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  const [proposalWithReviews] =
    trpc.decision.getProposalWithReviewAggregates.useSuspenseQuery({
      processInstanceId: assignment.processInstanceId,
      proposalId: assignment.proposal.id,
      phaseId: assignment.phaseId,
    });

  const otherReviews = excludeProfileId
    ? proposalWithReviews.reviews.filter(
        (review) => review.reviewer.id !== excludeProfileId,
      )
    : proposalWithReviews.reviews;

  if (otherReviews.length === 0) {
    return (
      <p className="py-8 text-center text-base text-neutral-gray4">
        {t('No other reviews yet')}
      </p>
    );
  }

  return (
    <ReviewsPanel
      proposalWithReviews={proposalWithReviews}
      rubricTemplate={rubricTemplate}
      selectedAssignmentId={selectedAssignmentId}
      onSelectAssignment={setSelectedAssignmentId}
      excludeProfileId={excludeProfileId}
      hideSummaryHeader
    />
  );
}

function OtherReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
