'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { ReviewSettings } from '@op/common/client';
import { Skeleton, SkeletonText } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  ReviewFormProvider,
  type ReviewFormStatus,
} from '../Review/ReviewFormContext';
import { ReviewRubricForm } from '../Review/ReviewRubricForm';
import { BackToReviewers } from '../ReviewsPanel/BackToReviewers';

interface OwnReviewPanelProps {
  decisionSlug: string;
  assignmentId: string;
  reviewSettings: ReviewSettings;
  onBack: () => void;
  /** Runs after a submit or an update; the host closes the panel. */
  onCompleted: () => void;
  initiallyEditing?: boolean;
  /** Hands the form's primary action up; the host's top bar renders it. */
  onStatusChange: (status: ReviewFormStatus) => void;
}

/**
 * The viewer's own review form as a state of the Review Progress panel.
 *
 * Loading stays inside this boundary so opening the form never blanks the
 * proposal pane beside it, and the primary action is reported to the host
 * rather than rendered here — its top bar owns that button.
 */
export function OwnReviewPanel({
  decisionSlug,
  assignmentId,
  reviewSettings,
  onBack,
  onCompleted,
  initiallyEditing,
  onStatusChange,
}: OwnReviewPanelProps) {
  return (
    <APIErrorBoundary fallbacks={{ default: () => <OwnReviewPanelError /> }}>
      <Suspense fallback={<OwnReviewPanelSkeleton />}>
        <ReviewFormProvider
          assignmentId={assignmentId}
          decisionSlug={decisionSlug}
          // Revisions belong to the reviewer surface.
          allowRevisions={false}
          onCompleted={onCompleted}
          onStatusChange={onStatusChange}
          initiallyEditing={initiallyEditing}
        >
          <div className="flex flex-col gap-6">
            <BackToReviewers onClick={onBack} />
            {/* openReviews off like allowRevisions above: the host surface
                already lists everyone's reviews. */}
            <ReviewRubricForm
              settings={{ ...reviewSettings, openReviews: false }}
              previousReviewPhases={[]}
            />
          </div>
        </ReviewFormProvider>
      </Suspense>
    </APIErrorBoundary>
  );
}

const OwnReviewPanelSkeleton = () => (
  <div className="flex flex-col gap-6">
    <Skeleton className="h-5 w-40" />
    <Skeleton className="h-8 w-48" />
    <SkeletonText lines={4} />
  </div>
);

const OwnReviewPanelError = () => {
  const t = useTranslations();

  return (
    <p className="text-base text-muted-foreground">
      {t('Something went wrong on our end. Please try again')}
    </p>
  );
};
