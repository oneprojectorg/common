'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import { ProposalReviewState, type ReviewSettings } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { SplitPane } from '@op/sense/SplitPane';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { useQueryState } from 'nuqs';
import { usePostHog } from 'posthog-js/react';
import { type ReactNode, useCallback, useState } from 'react';
import { LuCheck, LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { ProposalPreview } from '../ProposalPreview';
import { AuthorNotesSection } from '../Review/AuthorNotesSection';
import type { ReviewFormStatus } from '../Review/ReviewFormContext';
import type { PreviousReviewPhase } from '../Review/ReviewTabs';
import {
  PhaseReviews,
  PhaseReviewsTabPanel,
} from '../ReviewsPanel/PhaseReviews';
import type { OwnReviewEntry } from '../ReviewsPanel/ReviewsPanel';
import { ReviewsPanel } from '../ReviewsPanel/ReviewsPanel';
import { TranslateLink } from '../TranslateLink';
import { useTranslateProposal } from '../useTranslateProposal';
import { OwnReviewPanel } from './OwnReviewPanel';
import { ReviewSummaryAdvanceFooter } from './ReviewSummaryAdvanceFooter';
import { ReviewedVersionPane } from './ReviewedVersionPane';

interface ReviewSummaryViewProps {
  decisionSlug: string;
  instanceId: string;
  proposalId: string;
  proposalProfileId: string;
  phaseId: string;
  isPhaseInProgress?: boolean;
  reviewSettings: ReviewSettings;
  previousReviewPhases: PreviousReviewPhase[];
}

const REVIEW_PROGRESS_TAB = 'review-progress';
const PHASE_TAB_PREFIX = 'phase-reviews-';

export function ReviewSummaryView({
  decisionSlug,
  instanceId,
  proposalId,
  proposalProfileId,
  phaseId,
  isPhaseInProgress = false,
  reviewSettings,
  previousReviewPhases,
}: ReviewSummaryViewProps) {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const utils = trpc.useUtils();

  const [[proposalWithReviews, proposal, { items: ownAssignments }]] =
    trpc.useSuspenseQueries((t) => [
      t.decision.getProposalWithReviewAggregates(
        {
          processInstanceId: instanceId,
          proposalId,
          phaseId,
        },
        { refetchOnMount: 'always' },
      ),
      t.decision.getProposal({ profileId: proposalProfileId }),
      // Self-scoped, and scoped to the phase this screen describes — the same
      // one the aggregates above use.
      t.decision.listReviewAssignments(
        {
          processInstanceId: instanceId,
          proposalProfileId,
          phaseId,
          sort: 'newest',
        },
        { refetchOnMount: 'always' },
      ),
    ]);

  const rubricTemplate = proposalWithReviews.rubricTemplate;

  const { link, translation } = useTranslateProposal(proposal);

  // 'newest' orders by assignedAt in SQL, as ProposalReviewsLayout does.
  const ownAssignment = ownAssignments[0];

  const [selectedAssignmentId, setSelectedAssignmentId] = useQueryState(
    'assignment',
    { history: 'push' },
  );

  // Never the URL: opening the form is not a navigation.
  const [isOwnFormOpen, setIsOwnFormOpen] = useState(false);
  const [ownFormStatus, setOwnFormStatus] = useState<ReviewFormStatus | null>(
    null,
  );
  const [isSavingOwnReview, setIsSavingOwnReview] = useState(false);
  // The selected review and the own form belong to "Review Progress", so
  // leaving that tab clears both.
  const [activeTab, setActiveTab] = useState(REVIEW_PROGRESS_TAB);

  // Guarded: writing this unconditionally pushes a history entry for the
  // same URL.
  const clearSelectedAssignment = useCallback(() => {
    if (selectedAssignmentId) {
      setSelectedAssignmentId(null);
    }
  }, [selectedAssignmentId, setSelectedAssignmentId]);

  const openOwnForm = useCallback(() => {
    setActiveTab(REVIEW_PROGRESS_TAB);
    clearSelectedAssignment();
    setOwnFormStatus(null);
    setIsOwnFormOpen(true);
  }, [clearSelectedAssignment]);

  const closeOwnForm = useCallback(() => {
    setOwnFormStatus(null);
    setIsOwnFormOpen(false);
  }, []);

  const changeTab = useCallback(
    (value: string) => {
      setActiveTab(value);
      if (value !== REVIEW_PROGRESS_TAB) {
        clearSelectedAssignment();
        closeOwnForm();
      }
    },
    [clearSelectedAssignment, closeOwnForm],
  );

  // Kept for the submitter's own pane, which must be correct with the
  // realtime socket down.
  const handleOwnReviewCompleted = useCallback(() => {
    setOwnFormStatus(null);
    setIsOwnFormOpen(false);
    void utils.decision.getProposalWithReviewAggregates.invalidate({
      processInstanceId: instanceId,
      proposalId,
      phaseId,
    });
  }, [utils, instanceId, proposalId, phaseId]);

  const currentProfileId = user.currentProfile?.id;

  const ownReviewIsSubmitted =
    ownAssignment?.review?.state === ProposalReviewState.SUBMITTED;

  const ownReview: OwnReviewEntry | undefined =
    ownAssignment && currentProfileId
      ? {
          profileId: currentProfileId,
          hasSubmitted: ownReviewIsSubmitted,
          onOpenForm: openOwnForm,
        }
      : undefined;

  const saveOwnReview = async () => {
    if (!ownFormStatus) {
      return;
    }
    setIsSavingOwnReview(true);
    await ownFormStatus.submit();
    setIsSavingOwnReview(false);
  };

  // `canEditReview` already implies a submitted review, and only a submitted
  // review has a row to drill into.
  const isOwnDetailOpen =
    !!ownAssignment && selectedAssignmentId === ownAssignment.assignment.id;
  const canEditOwnReview = !!ownAssignment?.canEditReview;

  // Only a review the aggregates flagged stale switches the left pane.
  const selectedStaleReview = selectedAssignmentId
    ? proposalWithReviews.reviews.find(
        (item) =>
          item.review.assignmentId === selectedAssignmentId &&
          item.isReviewOutOfDate,
      )
    : undefined;

  const currentProposalPane = (
    <ProposalPreview
      proposal={proposal}
      translation={translation}
      translateLink={<TranslateLink translation={link} />}
      // The reviews on the right are read against the author's last
      // resubmission.
      headerBanner={<AuthorNotesSection proposalId={proposalId} />}
    />
  );

  const reviewProgress = (
    <>
      {/* Outside the form, or the live region announces every keystroke. */}
      <span role="status" className="sr-only">
        {isOwnFormOpen
          ? t('decisions.review.reviewProposalHeading')
          : t('decisions.review.reviewProgressHeading')}
      </span>

      {isOwnFormOpen && ownAssignment ? (
        <OwnReviewPanel
          decisionSlug={decisionSlug}
          assignmentId={ownAssignment.assignment.id}
          reviewSettings={reviewSettings}
          onBack={closeOwnForm}
          onCompleted={handleOwnReviewCompleted}
          initiallyEditing={ownReviewIsSubmitted}
          onStatusChange={setOwnFormStatus}
        />
      ) : (
        <ReviewsPanel
          proposalWithReviews={proposalWithReviews}
          rubricTemplate={rubricTemplate}
          selectedAssignmentId={selectedAssignmentId}
          onSelectAssignment={setSelectedAssignmentId}
          title={
            isPhaseInProgress
              ? t('decisions.review.reviewProgressHeading')
              : undefined
          }
          ownReview={ownReview}
        />
      )}
    </>
  );

  return (
    <div
      className={cn(
        'flex h-dvh flex-col bg-white',
        !isPhaseInProgress && 'pb-14',
      )}
    >
      <DecisionSubpageHeader
        backHref={`/decisions/${decisionSlug}/current`}
        backLabel={t('Back')}
      >
        {/* Swaps without a navigation. */}
        <div aria-live="polite">
          {isOwnFormOpen
            ? ownFormStatus && (
                <Button
                  onClick={saveOwnReview}
                  disabled={!ownFormStatus.canSubmit}
                  loading={isSavingOwnReview}
                >
                  <LuCheck className="size-4" />
                  {ownReviewIsSubmitted
                    ? t('decisions.review.updateReviewAction')
                    : t('decisions.review.submitReviewAction')}
                </Button>
              )
            : isOwnDetailOpen &&
              canEditOwnReview && (
                <Button variant="outline" onClick={openOwnForm}>
                  <LuPencil className="size-4" />
                  {t('decisions.review.editReviewAction')}
                </Button>
              )}
        </div>
      </DecisionSubpageHeader>

      <SplitPane className="mx-auto max-w-6xl" defaultMobileTabId="summary">
        <SplitPane.Pane
          id="proposal"
          label={t('decisions.proposals.proposalLabel')}
        >
          {selectedStaleReview && !isOwnFormOpen ? (
            <ReviewedVersionPane
              // Remount per reviewer so the skeleton covers the next read.
              key={selectedStaleReview.review.id}
              reviewId={selectedStaleReview.review.id}
              reviewerName={
                selectedStaleReview.reviewer.name ??
                selectedStaleReview.reviewer.slug
              }
            >
              {currentProposalPane}
            </ReviewedVersionPane>
          ) : (
            currentProposalPane
          )}
        </SplitPane.Pane>
        <SplitPane.Pane
          id="summary"
          label={
            isPhaseInProgress
              ? t('decisions.review.reviewProgressHeading')
              : t('decisions.review.reviewSummaryHeading')
          }
        >
          {previousReviewPhases.length === 0 ? (
            reviewProgress
          ) : (
            <ReviewSummaryTabs
              instanceId={instanceId}
              proposalId={proposalId}
              phaseId={phaseId}
              previousReviewPhases={previousReviewPhases}
              activeTab={activeTab}
              onTabChange={changeTab}
              reviewProgress={reviewProgress}
            />
          )}
        </SplitPane.Pane>
      </SplitPane>

      {!isPhaseInProgress && (
        <ReviewSummaryAdvanceFooter
          instanceId={instanceId}
          proposalId={proposalId}
          phaseId={phaseId}
        />
      )}
    </div>
  );
}

function ReviewSummaryTabs({
  instanceId,
  proposalId,
  phaseId,
  previousReviewPhases,
  activeTab,
  onTabChange,
  reviewProgress,
}: {
  instanceId: string;
  proposalId: string;
  phaseId: string;
  previousReviewPhases: PreviousReviewPhase[];
  activeTab: string;
  onTabChange: (value: string) => void;
  reviewProgress: ReactNode;
}) {
  const t = useTranslations();
  const posthog = usePostHog();

  return (
    <Tabs
      className="gap-4"
      value={activeTab}
      onValueChange={(value: string, eventDetails) => {
        onTabChange(value);
        // Only user-initiated switches count as opening a tab.
        if (eventDetails.reason !== 'none') {
          return;
        }
        const isPreviousPhase = value !== REVIEW_PROGRESS_TAB;
        posthog.capture(
          'review_tab_opened',
          getDecisionCommonProperties({
            decisionInstanceId: instanceId,
            proposalId,
            additionalProps: {
              tab: isPreviousPhase ? 'previous_phase' : 'review_progress',
              phase_id: isPreviousPhase
                ? value.slice(PHASE_TAB_PREFIX.length)
                : phaseId,
            },
          }),
        );
      }}
    >
      <div className="w-full border-b">
        <TabsList
          variant="line"
          aria-label={t('decisions.review.reviewSummaryHeading')}
          className="flex gap-4 overflow-x-auto"
        >
          <TabsTrigger value={REVIEW_PROGRESS_TAB}>
            {t('decisions.review.reviewProgressHeading')}
          </TabsTrigger>
          {previousReviewPhases.map((phase) => (
            <TabsTrigger
              key={phase.id}
              value={`${PHASE_TAB_PREFIX}${phase.id}`}
            >
              {t.rich('decisions.review.reviewsFromPhase', {
                phase: phase.name,
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Kept mounted so an open own-review form survives a tab switch. */}
      <TabsContent value={REVIEW_PROGRESS_TAB} keepMounted>
        {reviewProgress}
      </TabsContent>

      {previousReviewPhases.map((phase) => (
        <PhaseReviewsTabPanel
          key={phase.id}
          value={`${PHASE_TAB_PREFIX}${phase.id}`}
        >
          <PhaseReviews
            processInstanceId={instanceId}
            proposalId={proposalId}
            phaseId={phase.id}
            isCurrentPhase={false}
            emptyMessage={t('decisions.review.noReviewsInPhase')}
          />
        </PhaseReviewsTabPanel>
      ))}
    </Tabs>
  );
}
