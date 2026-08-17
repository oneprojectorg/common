'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalReviewState } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { SplitPane } from '@op/sense/SplitPane';
import { cn } from '@op/sense/lib/utils';
import { useQueryState } from 'nuqs';
import { useCallback, useState } from 'react';
import { LuCheck, LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { ProposalPreview } from '../ProposalPreview';
import type { ReviewFormStatus } from '../Review/ReviewFormContext';
import type { OwnReviewEntry } from '../ReviewsPanel/ReviewsPanel';
import { ReviewsPanel } from '../ReviewsPanel/ReviewsPanel';
import { TranslateBanner } from '../TranslateBanner';
import { useTranslateProposal } from '../useTranslateProposal';
import { OwnReviewPanel } from './OwnReviewPanel';
import { ReviewSummaryAdvanceFooter } from './ReviewSummaryAdvanceFooter';

interface ReviewSummaryViewProps {
  decisionSlug: string;
  instanceId: string;
  proposalId: string;
  proposalProfileId: string;
  phaseId: string | undefined;
  isPhaseInProgress?: boolean;
}

export function ReviewSummaryView({
  decisionSlug,
  instanceId,
  proposalId,
  proposalProfileId,
  phaseId,
  isPhaseInProgress = false,
}: ReviewSummaryViewProps) {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const utils = trpc.useUtils();

  const [[proposalWithReviews, proposal, ownAssignments]] =
    trpc.useSuspenseQueries((t) => [
      t.decision.getProposalWithReviewAggregates({
        processInstanceId: instanceId,
        proposalId,
        phaseId,
      }),
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
        // Force a client-side fetch so the query registers its invalidation
        // channel via the client link; the SSR prefetch cannot.
        { refetchOnMount: 'always' },
      ),
    ]);

  const rubricTemplate = proposalWithReviews.rubricTemplate;

  // This screen is the admin half of `/proposal/<id>/reviews`; the reviewer
  // half gets its translation from `ReviewTranslationProvider`, which is keyed
  // by an assignment this screen does not have. An admin reading a proposal in
  // a language they don't speak had no control at all.
  //
  // Scoped to the proposal deliberately. `translateRubric` takes an assignment
  // id, and reviewer-authored notes have no endpoint, so detection stays on the
  // proposal rather than offering a control that cannot move what triggered it.
  const {
    translation,
    showBanner,
    isTranslating,
    targetLanguageName,
    handleTranslate,
    dismissBanner,
  } = useTranslateProposal(proposal);

  // 'newest' orders by assignedAt in SQL, as ProposalReviewsLayout does.
  const ownAssignment = ownAssignments.assignments[0];

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

  const openOwnForm = useCallback(() => {
    // Guarded: writing this unconditionally pushes a history entry for the
    // same URL when the form opens from the list.
    if (selectedAssignmentId) {
      setSelectedAssignmentId(null);
    }
    setOwnFormStatus(null);
    setIsOwnFormOpen(true);
  }, [selectedAssignmentId, setSelectedAssignmentId]);

  const closeOwnForm = useCallback(() => {
    setOwnFormStatus(null);
    setIsOwnFormOpen(false);
  }, []);

  // The assignment list refreshes itself through its review channel; the
  // aggregates router registers none, so only that one needs a nudge.
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
        <div className="flex items-center gap-4" aria-live="polite">
          {isOwnFormOpen
            ? ownFormStatus && (
                <Button
                  onClick={saveOwnReview}
                  disabled={!ownFormStatus.canSubmit}
                  loading={isSavingOwnReview}
                >
                  <LuCheck className="size-4" />
                  {ownReviewIsSubmitted
                    ? t('Update review')
                    : t('Submit review')}
                </Button>
              )
            : isOwnDetailOpen &&
              canEditOwnReview && (
                <Button variant="outline" onClick={openOwnForm}>
                  <LuPencil className="size-4" />
                  {t('Edit review')}
                </Button>
              )}
        </div>
      </DecisionSubpageHeader>

      <SplitPane className="mx-auto max-w-6xl" defaultMobileTabId="summary">
        <SplitPane.Pane
          id="proposal"
          label={<TranslatedText text="Proposal" />}
        >
          <ProposalPreview proposal={proposal} translation={translation} />
        </SplitPane.Pane>
        <SplitPane.Pane
          id="summary"
          label={
            isPhaseInProgress ? (
              <TranslatedText text="Review Progress" />
            ) : (
              <TranslatedText text="Review Summary" />
            )
          }
        >
          {/* Outside the panel: a live region around the form would announce
              every keystroke. */}
          <span role="status" className="sr-only">
            {isOwnFormOpen ? t('Review Proposal') : t('Review Progress')}
          </span>

          {isOwnFormOpen && ownAssignment ? (
            <OwnReviewPanel
              decisionSlug={decisionSlug}
              assignmentId={ownAssignment.assignment.id}
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
              title={isPhaseInProgress ? t('Review Progress') : undefined}
              ownReview={ownReview}
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

      {showBanner && (
        <TranslateBanner
          onTranslate={handleTranslate}
          onDismiss={dismissBanner}
          isTranslating={isTranslating}
          languageName={targetLanguageName}
        />
      )}
    </div>
  );
}
