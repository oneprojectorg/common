'use client';

import {
  canEngageWithProposals,
  useProposalEngagement,
} from '@/hooks/useProposalEngagement';
import { useTrackPageView } from '@/hooks/useTrackPageView';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import type { Proposal, ProposalSelection } from '@op/common/client';
import { SplitPane } from '@op/sense/SplitPane';
import { useQueryStates } from 'nuqs';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ContributingIdeas } from './ContributingIdeas';
import { ProposalComments } from './ProposalComments';
import { ProposalFeedbackPanel } from './ProposalFeedbackPanel';
import { ProposalMergeNotice } from './ProposalMergeNotice';
import { ProposalPreview } from './ProposalPreview';
import { ProposalViewLayout } from './ProposalViewLayout';
import { RevisedOnBadge } from './Review/AuthorRevisionNote';
import { ReviewNotesPanel } from './ReviewNotesPanel';
import { TranslateBanner } from './TranslateBanner';
import type { ProposalAffordances } from './getProposalAffordances';
import {
  proposalEditorReviewRevisionParser,
  proposalFeedbackPanelParser,
  proposalReviewNotesParser,
} from './proposalEditor/proposalEditorAsideParams';
import { useProposalFeedback } from './useProposalFeedback';
import { useProposalReviewNotes } from './useProposalReviewNotes';
import { useTranslateProposal } from './useTranslateProposal';

/** How often to re-fetch while the document is still propagating from TipTap. */
const DOCUMENT_POLL_INTERVAL_MS = 2500;
/**
 * How long to keep polling for a missing document before treating it as
 * truly not found. Bounds the "still loading" window so a genuinely absent
 * document eventually surfaces an error instead of spinning forever.
 */
const DOCUMENT_POLL_TIMEOUT_MS = 20000;

export type ProposalDocumentState = 'ready' | 'pending' | 'error';

export function ProposalView({
  proposal: initialProposal,
  affordances,
  isAuthor,
  decisionRoot,
  selection,
}: {
  proposal: Proposal;
  /** What this viewer may see here — see `getProposalAffordances`. */
  affordances: ProposalAffordances;
  /** The viewer wrote the proposal; only the note card's title depends on it. */
  isAuthor: boolean;
  decisionRoot: string;
  selection: ProposalSelection | null;
}) {
  const t = useTranslations();

  // When the document fetch failed server-side it comes back as
  // `{ type: 'unavailable' }`. That can be transient (still syncing from the
  // collaboration server), so poll until it resolves, and only after a bounded
  // wait treat it as truly missing.
  const [documentLoadTimedOut, setDocumentLoadTimedOut] = useState(false);

  const { data: proposal } = trpc.decision.getProposal.useQuery(
    {
      profileId: initialProposal.profileId,
    },
    {
      refetchInterval: (query) =>
        query.state.data?.documentContent?.type === 'unavailable' &&
        !documentLoadTimedOut
          ? DOCUMENT_POLL_INTERVAL_MS
          : false,
    },
  );

  // Safety check - fallback to initial data if query returns undefined
  const currentProposal = proposal || initialProposal;

  const isDocumentUnavailable =
    currentProposal.documentContent?.type === 'unavailable';

  useEffect(() => {
    if (!isDocumentUnavailable) {
      setDocumentLoadTimedOut(false);
      return;
    }

    const timer = setTimeout(
      () => setDocumentLoadTimedOut(true),
      DOCUMENT_POLL_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [isDocumentUnavailable]);

  const documentState: ProposalDocumentState = isDocumentUnavailable
    ? documentLoadTimedOut
      ? 'error'
      : 'pending'
    : 'ready';

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

  const [
    {
      reviewRevision,
      reviewNotes: isReviewNotesRequested,
      feedback: isFeedbackPanelOpen,
    },
    setQueryState,
  ] = useQueryStates({
    reviewRevision: proposalEditorReviewRevisionParser,
    reviewNotes: proposalReviewNotesParser,
    feedback: proposalFeedbackPanelParser,
  });

  // `feedback`, not `revisions`: the sheet is the same record for every viewer
  // it admits, and it keeps showing after the review phase ends — which is
  // exactly when `revisions` goes false.
  const { openRequests, noteGroups, hasReviewNotes } = useProposalReviewNotes({
    proposalId: currentProposal.id,
    enabled: affordances.review.feedback,
  });

  // `?reviewRevision=<id>` stays a working deep link; the sheet lists every
  // cycle rather than the one request the link names.
  const isReviewNotesOpen =
    hasReviewNotes && Boolean(isReviewNotesRequested || reviewRevision);

  // Session-local, like the editor's: we hold no read state for revision
  // requests, and the dot only has to stop nagging once the sheet was opened.
  const [hasOpenedReviewNotes, setHasOpenedReviewNotes] = useState(false);

  const { notes, hasFeedback } = useProposalFeedback({
    proposalId: currentProposal.id,
    enabled: affordances.review.feedback,
  });

  const toggleFeedbackPanel = useCallback(() => {
    void setQueryState(
      { feedback: isFeedbackPanelOpen ? null : true },
      { history: 'push', scroll: false },
    );
  }, [isFeedbackPanelOpen, setQueryState]);

  const toggleReviewNotes = useCallback(() => {
    setHasOpenedReviewNotes(true);
    void setQueryState(
      { reviewNotes: isReviewNotesOpen ? null : true, reviewRevision: null },
      { history: 'push', scroll: false },
    );
  }, [isReviewNotesOpen, setQueryState]);

  const {
    translation,
    showBanner,
    isTranslating,
    targetLanguageName,
    handleTranslate,
    dismissBanner,
  } = useTranslateProposal(currentProposal);

  // Most recent resubmission (if any) — drives the "Revised on" badge shown
  // inline in the submitter metadata row. The server orders newest first.
  const latestRespondedAt = noteGroups[0]?.respondedAt ?? null;

  const proposalBody: ReactNode = (
    <>
      <ProposalPreview
        proposal={currentProposal}
        selection={selection}
        documentState={documentState}
        // Everyone sees the counts; only a signed-in member with engagement
        // access gets the controls (the hook returns undefined otherwise).
        engagement={
          engagement
            ? {
                isLiked: engagement.isLiked,
                isFollowing: engagement.isFollowed,
                onLike: engagement.onLike,
                onFollow: engagement.onFollow,
              }
            : undefined
        }
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

      <ProposalComments
        proposal={currentProposal}
        decisionRoot={decisionRoot}
      />
    </>
  );

  const asidePane: { label: string; content: ReactNode } | null =
    isReviewNotesOpen
      ? {
          label: t('Review notes'),
          content: (
            <div className="flex flex-col gap-6 px-12 pt-12 pb-4">
              <ReviewNotesPanel
                openRequests={openRequests}
                noteGroups={noteGroups}
                isAuthor={isAuthor}
              />
            </div>
          ),
        }
      : isFeedbackPanelOpen && hasFeedback
        ? {
            label: t('Feedback'),
            content: (
              <ProposalFeedbackPanel
                feedbackItems={notes}
                title={t('Feedback')}
                subtitle={t(
                  'Notes reviewers shared while this proposal was under review',
                )}
              />
            ),
          }
        : null;

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
      // The admin overflow menu (shortlist / reject / hide) gates itself on
      // `proposal.access.admin` and on the proposal having left draft.
      moderationProposal={currentProposal}
      notices={
        <ProposalMergeNotice
          proposal={currentProposal}
          decisionRoot={decisionRoot}
        />
      }
      // Two independent disclosures: the revision-cycle record and the
      // reviewer notes. Both can show at once.
      reviewNotesToggle={
        hasReviewNotes
          ? {
              onToggle: toggleReviewNotes,
              isActive: isReviewNotesOpen,
              hasUnread: !hasOpenedReviewNotes && !isReviewNotesOpen,
            }
          : undefined
      }
      feedbackToggle={
        hasFeedback
          ? {
              onToggle: toggleFeedbackPanel,
              isActive: isFeedbackPanelOpen,
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
            label={t('Proposal')}
            className="gap-6 sm:gap-10"
          >
            {proposalBody}
          </SplitPane.Pane>
          <SplitPane.Pane
            id="feedback"
            label={asidePane.label}
            className="bg-white"
            unpadded
          >
            {asidePane.content}
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
