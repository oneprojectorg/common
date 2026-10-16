'use client';

import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import type { PreviousReviewPhase } from '@op/common/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { usePostHog } from 'posthog-js/react';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  PhaseReviews,
  PhaseReviewsTabPanel,
} from '../ReviewsPanel/PhaseReviews';
import { useReviewForm } from './ReviewFormContext';

const MY_REVIEW_TAB = 'my-review';
const OTHER_REVIEWS_TAB = 'other-reviews';
const PHASE_TAB_PREFIX = 'phase-reviews-';

/**
 * Tab shell for the "Review Proposal" panel:
 *
 * - "My review" — the reviewer's own form. Kept mounted so the form
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
      className="gap-4"
      defaultValue={MY_REVIEW_TAB}
      onValueChange={(value: string, eventDetails) => {
        // Only user-initiated switches are "opening a tab" — base-ui also
        // reports automatic selection/fallback changes (initial, disabled,
        // missing), which the previous react-aria shell never emitted.
        if (eventDetails.reason !== 'none') {
          return;
        }
        // One event covers every tab, split by `tab`: the reviewer's own form,
        // the current phase's "Other reviews", and the previous-phase
        // "Reviews from {phase}" tabs.
        const isPreviousPhase =
          value !== MY_REVIEW_TAB && value !== OTHER_REVIEWS_TAB;
        posthog.capture(
          'review_tab_opened',
          getDecisionCommonProperties({
            decisionInstanceId: assignment.processInstanceId,
            proposalId: assignment.proposal.id,
            additionalProps: {
              tab:
                value === MY_REVIEW_TAB
                  ? 'my_review'
                  : value === OTHER_REVIEWS_TAB
                    ? 'other_reviews'
                    : 'previous_phase',
              phase_id: isPreviousPhase
                ? value.slice(PHASE_TAB_PREFIX.length)
                : assignment.phaseId,
            },
          }),
        );
      }}
    >
      {/* sense `TabsList` is `w-fit`, so the underline track comes from a
          full-width wrapper (same pattern as the review queue's tabs). */}
      <div className="w-full border-b">
        <TabsList
          variant="line"
          aria-label={t('decisions.review.reviewProposalHeading')}
          className="flex gap-4 overflow-x-auto"
        >
          <TabsTrigger value={MY_REVIEW_TAB}>
            {t('decisions.review.myReviewTab')}
          </TabsTrigger>
          {showOtherReviews ? (
            <TabsTrigger value={OTHER_REVIEWS_TAB}>
              {t('decisions.review.otherReviewsTab')}
            </TabsTrigger>
          ) : null}
          {previousPhases.map((phase) => (
            <TabsTrigger
              key={phase.id}
              value={`${PHASE_TAB_PREFIX}${phase.id}`}
            >
              {t('decisions.review.reviewsFromPhase', { phase: phase.name })}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* `keepMounted` keeps the reviewer's own form alive across tab switches
          so in-flight answers and pending autosaves survive (base-ui's
          equivalent of react-aria's `shouldForceMount`). While hidden the
          panel carries both `hidden` (so it doesn't stack over the selected
          panel) and `inert` (so it can't take focus). */}
      <TabsContent value={MY_REVIEW_TAB} keepMounted>
        {myReview}
      </TabsContent>

      {showOtherReviews ? (
        <PhaseReviewsTabPanel value={OTHER_REVIEWS_TAB}>
          <PhaseReviews
            processInstanceId={assignment.processInstanceId}
            proposalId={assignment.proposal.id}
            phaseId={assignment.phaseId}
            isCurrentPhase
            excludeOwnReview
            emptyMessage={t('decisions.review.noOtherReviews')}
          />
        </PhaseReviewsTabPanel>
      ) : null}

      {previousPhases.map((phase) => (
        <PhaseReviewsTabPanel
          key={phase.id}
          value={`${PHASE_TAB_PREFIX}${phase.id}`}
        >
          <PhaseReviews
            processInstanceId={assignment.processInstanceId}
            proposalId={assignment.proposal.id}
            phaseId={phase.id}
            isCurrentPhase={false}
            emptyMessage={t('decisions.review.noReviewsInPhase')}
          />
        </PhaseReviewsTabPanel>
      ))}
    </Tabs>
  );
}
