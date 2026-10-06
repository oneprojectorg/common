import { parseDehydratedState } from '@op/api/dehydratedState';
import type { ReviewSettings } from '@op/common/client';
import { SplitPane } from '@op/sense/SplitPane';
import { HydrationBoundary } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ReviewFormProvider } from './ReviewFormContext';
import { ReviewNavbar } from './ReviewNavbar';
import { ReviewProposalPane } from './ReviewProposalPane';
import { ReviewRubricForm } from './ReviewRubricForm';
import type { PreviousReviewPhase } from './ReviewTabs';
import { ReviewTranslationProvider } from './ReviewTranslationContext';

export interface ReviewLayoutProps {
  decisionSlug: string;
  assignmentId: string;
  reviewSettings: ReviewSettings;
  previousReviewPhases: PreviousReviewPhase[];
  /** The assignment read on the server, which the review form hydrates from. */
  dehydratedState: string;
}

/** The reviewer's split-pane review screen. Its data comes from `loadReviewLayout`. */
export function ReviewLayout({
  decisionSlug,
  assignmentId,
  reviewSettings,
  previousReviewPhases,
  dehydratedState,
}: ReviewLayoutProps) {
  const t = useTranslations();
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

  return (
    <HydrationBoundary state={hydrationState}>
      <ReviewFormProvider
        assignmentId={assignmentId}
        decisionSlug={decisionSlug}
        reviewSettings={reviewSettings}
      >
        {/* Inside ReviewFormProvider: the proposal and the rubric it translates
            both come from the assignment that provider loads. */}
        <ReviewTranslationProvider assignmentId={assignmentId}>
          <div className="flex h-dvh flex-col overflow-hidden bg-white">
            <ReviewNavbar decisionSlug={decisionSlug} />

            <SplitPane
              className="mx-auto max-w-6xl"
              defaultMobileTabId="review"
            >
              <SplitPane.Pane
                id="proposal"
                label={t('decisions.proposals.proposalLabel')}
              >
                <ReviewProposalPane
                  decisionRoot={`/decisions/${decisionSlug}`}
                />
              </SplitPane.Pane>
              <SplitPane.Pane id="review" label={t('Review')}>
                <ReviewRubricForm previousReviewPhases={previousReviewPhases} />
              </SplitPane.Pane>
            </SplitPane>
          </div>
        </ReviewTranslationProvider>
      </ReviewFormProvider>
    </HydrationBoundary>
  );
}
