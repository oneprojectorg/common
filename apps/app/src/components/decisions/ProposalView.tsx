'use client';

import {
  canEngageWithProposals,
  useProposalEngagement,
} from '@/hooks/useProposalEngagement';
import { useTrackPageView } from '@/hooks/useTrackPageView';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import type { Proposal, ProposalSelection } from '@op/common/client';
import { SplitPane } from '@op/sense/SplitPane';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ContributingIdeas } from './ContributingIdeas';
import { ProposalComments } from './ProposalComments';
import { ProposalMergeNotice } from './ProposalMergeNotice';
import { ProposalPreview, toPreviewEngagement } from './ProposalPreview';
import { ProposalViewLayout } from './ProposalViewLayout';
import { RevisedOnBadge } from './Review/AuthorRevisionNote';
import { ReviewNotesPanel } from './ReviewNotesPanel';
import { TranslateBanner } from './TranslateBanner';
import type { ProposalAffordances } from './getProposalAffordances';
import { useCommentsAllowed } from './useCommentsAllowed';
import { useLiveProposalDocument } from './useLiveProposalDocument';
import { useProposalReviewNotes } from './useProposalReviewNotes';
import { useTranslateProposal } from './useTranslateProposal';

export function ProposalView({
  proposal: initialProposal,
  affordances,
  isAuthor,
  currentPhaseId,
  decisionRoot,
  selection,
}: {
  proposal: Proposal;
  /** What this viewer may see here — see `getProposalAffordances`. */
  affordances: ProposalAffordances;
  isAuthor: boolean;
  /** The instance's current phase; `null` on a legacy instance. */
  currentPhaseId: string | null;
  decisionRoot: string;
  selection: ProposalSelection | null;
}) {
  const t = useTranslations();
  const commentsEnabled = useCommentsAllowed(initialProposal.processInstanceId);

  const { proposal: currentProposal, documentState } =
    useLiveProposalDocument(initialProposal);

  const { processInstanceId, id: proposalId } = currentProposal;
  useTrackPageView(
    'proposal_viewed',
    getDecisionCommonProperties({
      decisionInstanceId: processInstanceId,
      proposalId,
    }),
    [processInstanceId, proposalId],
  );

  // Same hook the proposal card's metric toggles use, so the two surfaces
  // can't drift. Returns undefined when the viewer can't act.
  const engagement = useProposalEngagement({
    proposal: currentProposal,
    canEngage: canEngageWithProposals(currentProposal.access),
  });

  // Check if current user can edit (submitter or org admin)
  const canEdit = currentProposal.isEditable ?? false;

  const backHref = `${decisionRoot}/current`;
  const editHref = canEdit
    ? `${decisionRoot}/proposal/${currentProposal.profileId}/edit`
    : undefined;

  // `feedback`, not `revisions`: the sheet outlives the review phase.
  const reviewNotes = useProposalReviewNotes({
    proposalId: currentProposal.id,
    phaseId: currentPhaseId,
    enabled: affordances.review.feedback,
  });

  const {
    translation,
    showBanner,
    isTranslating,
    targetLanguageName,
    handleTranslate,
    dismissBanner,
  } = useTranslateProposal(currentProposal);

  // The server orders newest first.
  const latestRespondedAt = reviewNotes.noteGroups[0]?.respondedAt ?? null;

  const proposalBody: ReactNode = (
    <>
      <ProposalPreview
        proposal={currentProposal}
        selection={selection}
        documentState={documentState}
        // Everyone sees the counts; only a signed-in member with engagement
        // access gets the controls (the hook returns undefined otherwise).
        engagement={toPreviewEngagement(engagement)}
        translation={translation}
        submissionMetaSuffix={
          latestRespondedAt ? (
            <RevisedOnBadge respondedAt={latestRespondedAt} />
          ) : undefined
        }
      />

      <ContributingIdeas
        proposal={currentProposal}
        decisionRoot={decisionRoot}
      />

      {commentsEnabled && (
        <ProposalComments
          proposal={currentProposal}
          decisionRoot={decisionRoot}
        />
      )}
    </>
  );

  const asidePane: ReactNode = reviewNotes.isOpen ? (
    <div className="flex flex-col gap-6 px-12 pt-12 pb-4">
      <ReviewNotesPanel
        openRequests={reviewNotes.openRequests}
        noteGroups={reviewNotes.noteGroups}
        feedbackNotes={reviewNotes.feedbackNotes}
        isAuthor={isAuthor}
      />
    </div>
  ) : null;

  return (
    <ProposalViewLayout
      backHref={backHref}
      reportProposalId={proposalId}
      editHref={editHref}
      canEdit={canEdit}
      // Same viewer-access bit the comments prompt reads (getProposal mirrors
      // the decision profile's SUBMIT_PROPOSALS grant onto proposal.access),
      // so the Join button, the modal mount, and the prompt can't diverge —
      // on any route that renders a proposal, including the legacy one.
      canJoin={currentProposal.access?.submitProposals === true}
      commentsEnabled={commentsEnabled}
      // The admin overflow menu (shortlist / reject / hide) gates itself on
      // `proposal.access.admin` and on the proposal having left draft.
      moderationProposal={currentProposal}
      notices={
        <ProposalMergeNotice
          proposal={currentProposal}
          decisionRoot={decisionRoot}
        />
      }
      reviewNotesToggle={
        reviewNotes.hasReviewNotes
          ? {
              onToggle: reviewNotes.toggle,
              isActive: reviewNotes.isOpen,
            }
          : undefined
      }
    >
      {asidePane ? (
        <SplitPane className="mx-auto w-full max-w-6xl">
          {/* Same section rhythm as the standalone column below: a section's
              own `pt` mirrors this gap, so every rule sits centred between the
              two sections it separates. */}
          <SplitPane.Pane
            id="proposal"
            label={t('decisions.proposals.proposalLabel')}
            className="gap-6 sm:gap-10"
          >
            {proposalBody}
          </SplitPane.Pane>
          <SplitPane.Pane
            id="reviewNotes"
            label={t('decisions.review.reviewNotesHeading')}
            className="bg-background"
            unpadded
          >
            {asidePane}
          </SplitPane.Pane>
        </SplitPane>
      ) : (
        // Figma: 544px (max-w-136) centred column, 56px vertical padding and a
        // 40px region gap on desktop; 16/32 padding and a 24px gap on mobile.
        <div className="flex-1 px-4 py-8 sm:px-6 sm:py-14">
          <div className="mx-auto flex max-w-136 flex-col gap-6 sm:gap-10">
            {proposalBody}
          </div>
        </div>
      )}

      {/* Translation banner */}
      {showBanner && (
        <TranslateBanner
          onTranslate={handleTranslate}
          onDismiss={dismissBanner}
          isTranslating={isTranslating}
          languageName={targetLanguageName}
        />
      )}
    </ProposalViewLayout>
  );
}
