'use client';

import { useTrackPageView } from '@/hooks/useTrackPageView';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import type { Proposal, ProposalSelection } from '@op/common/client';
import { SplitPane } from '@op/sense/SplitPane';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ContributingIdeas } from './ContributingIdeas';
import { ProposalBody } from './Proposal/ProposalBody';
import { ProposalCommentsSection } from './Proposal/ProposalCommentsSection';
import { ProposalProvider } from './Proposal/proposalContext';
import { ProposalMergeNotice } from './ProposalMergeNotice';
import { ProposalViewLayout } from './ProposalViewLayout';
import { RevisedOnBadge } from './Review/AuthorRevisionNote';
import { ReviewNotesPanel } from './ReviewNotesPanel';
import type { ProposalAffordances } from './getProposalAffordances';
import { useCommentsAllowed } from './useCommentsAllowed';
import { useLiveProposalDocument } from './useLiveProposalDocument';
import { useProposalReviewNotes } from './useProposalReviewNotes';

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

  // The server orders newest first.
  const latestRespondedAt = reviewNotes.noteGroups[0]?.respondedAt ?? null;

  const proposalBody: ReactNode = (
    <ProposalBody
      selection={selection}
      submissionMetaSuffix={
        latestRespondedAt ? (
          <RevisedOnBadge respondedAt={latestRespondedAt} />
        ) : undefined
      }
    >
      <ContributingIdeas />
      <ProposalCommentsSection />
    </ProposalBody>
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
      canEngage={canEngageWithProposals(currentProposal.access)}
      commentsEnabled={commentsEnabled}
      moderationProposal={affordances.moderation ? currentProposal : undefined}
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
      <ProposalProvider
        proposal={currentProposal}
        decisionRoot={decisionRoot}
        documentState={documentState}
      >
        {asidePane ? (
          <SplitPane className="mx-auto w-full max-w-6xl">
            <SplitPane.Pane
              id="proposal"
              label={t('decisions.proposals.proposalLabel')}
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
            <div className="mx-auto max-w-136">{proposalBody}</div>
          </div>
        )}
      </ProposalProvider>
    </ProposalViewLayout>
  );
}
