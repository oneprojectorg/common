'use client';

import {
  canEngageWithProposals,
  useProposalEngagement,
} from '@/hooks/useProposalEngagement';
import { useTrackPageView } from '@/hooks/useTrackPageView';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  ProposalReviewRequestState,
  type ProposalSelection,
} from '@op/common/client';
import { SplitPane } from '@op/sense/SplitPane';
import { useQueryStates } from 'nuqs';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ContributingIdeas } from './ContributingIdeas';
import { ProposalComments } from './ProposalComments';
import { ProposalFeedbackPanel } from './ProposalFeedbackPanel';
import { ProposalMergeNotice } from './ProposalMergeNotice';
import { ProposalPreview } from './ProposalPreview';
import { ProposalRevisionSubmittedPanel } from './ProposalRevisionSubmittedPanel';
import { ProposalViewLayout } from './ProposalViewLayout';
import { RevisedOnBadge } from './Review/AuthorRevisionNote';
import { TranslateBanner } from './TranslateBanner';
import type { ProposalReviewVisibility } from './getProposalReviewVisibility';
import {
  proposalEditorReviewRevisionParser,
  proposalFeedbackPanelParser,
} from './proposalEditor/proposalEditorAsideParams';
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
  visibility,
  decisionRoot,
  selection,
}: {
  proposal: Proposal;
  /** What this viewer may see here — see `getProposalReviewVisibility`. */
  visibility: ProposalReviewVisibility;
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

  const [{ reviewRevision, feedback: isFeedbackPanelOpen }, setQueryState] =
    useQueryStates({
      reviewRevision: proposalEditorReviewRevisionParser,
      feedback: proposalFeedbackPanelParser,
    });

  // The view panel is "Revision submitted" — only surface entries the author
  // has already responded to. Pending requests are handled by the editor.
  // The server throws UnauthorizedError when the viewer lacks review access;
  // treat any error as "no revisions" so the proposal still renders.
  const { data: revisionData, error: revisionError } =
    trpc.decision.listProposalRevisionRequests.useQuery(
      {
        proposalId: currentProposal.id,
        states: [ProposalReviewRequestState.RESUBMITTED],
      },
      { enabled: visibility.revisions, throwOnError: false, retry: false },
    );

  const submittedRevisions = revisionError
    ? []
    : (revisionData?.revisionRequests ?? []);

  const firstRevisionRequestId =
    submittedRevisions[0]?.revisionRequest.id ?? null;

  const activeRevisionRequest = reviewRevision
    ? (submittedRevisions.find((r) => r.revisionRequest.id === reviewRevision)
        ?.revisionRequest ?? null)
    : null;

  // Gated on `feedback`, not `revisions`: the panel carries the history after
  // the review phase ends, which is exactly when `revisions` goes false. Same
  // procedure as the query above — they differ by the `states` filter.
  const [feedbackQuery, allRevisionQuery] = trpc.useQueries((t) => [
    t.decision.listProposalFeedback(
      { proposalId: currentProposal.id },
      { enabled: visibility.feedback, throwOnError: false, retry: false },
    ),
    t.decision.listProposalRevisionRequests(
      { proposalId: currentProposal.id },
      { enabled: visibility.feedback, throwOnError: false, retry: false },
    ),
  ]);

  const feedbackItems = feedbackQuery.error
    ? []
    : (feedbackQuery.data?.items ?? []);

  const feedbackRevisionRequests = allRevisionQuery.error
    ? []
    : (allRevisionQuery.data?.revisionRequests ?? []).map(
        (item) => item.revisionRequest,
      );

  const hasFeedback =
    feedbackItems.length > 0 || feedbackRevisionRequests.length > 0;

  const toggleFeedbackPanel = useCallback(() => {
    void setQueryState(
      { feedback: isFeedbackPanelOpen ? null : true },
      { history: 'push', scroll: false },
    );
  }, [isFeedbackPanelOpen, setQueryState]);

  const toggleRevisionRequest = useCallback(() => {
    if (!firstRevisionRequestId) {
      return;
    }

    void setQueryState(
      {
        reviewRevision:
          reviewRevision === firstRevisionRequestId
            ? null
            : firstRevisionRequestId,
      },
      { history: 'push', scroll: false },
    );
  }, [firstRevisionRequestId, reviewRevision, setQueryState]);

  const {
    translation,
    showBanner,
    isTranslating,
    targetLanguageName,
    handleTranslate,
    dismissBanner,
  } = useTranslateProposal(currentProposal);

  // Most recently responded revision (if any) — drives the "Revised on"
  // badge shown inline in the submitter metadata row.
  const latestResponse = submittedRevisions[0]?.revisionRequest ?? null;

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
          latestResponse?.respondedAt ? (
            <RevisedOnBadge respondedAt={latestResponse.respondedAt} />
          ) : undefined
        }
      />

      <ContributingIdeas
        proposal={currentProposal}
        decisionRoot={decisionRoot}
      />

      <ProposalComments proposal={currentProposal} />
    </>
  );

  const asidePane: { label: string; content: ReactNode } | null =
    activeRevisionRequest
      ? {
          label: t('Revision feedback'),
          content: (
            <ProposalRevisionSubmittedPanel
              revisionRequest={activeRevisionRequest}
            />
          ),
        }
      : isFeedbackPanelOpen && hasFeedback
        ? {
            label: t('Feedback'),
            content: (
              <ProposalFeedbackPanel
                feedbackItems={feedbackItems}
                revisionRequests={feedbackRevisionRequests}
                title={t('Feedback')}
                subtitle={t(
                  'Notes reviewers shared while this proposal was under review',
                )}
                revisionRequestLabel={t('Revision request')}
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
      // One disclosure for both panes: mid-phase it opens the submitted
      // revision, and the feedback panel once `visibility.revisions` is false.
      feedbackToggle={
        firstRevisionRequestId
          ? {
              onToggle: toggleRevisionRequest,
              isActive: Boolean(activeRevisionRequest),
            }
          : hasFeedback
            ? {
                onToggle: toggleFeedbackPanel,
                isActive: isFeedbackPanelOpen,
              }
            : undefined
      }
    >
      {asidePane ? (
        <SplitPane className="mx-auto w-full max-w-6xl">
          <SplitPane.Pane id="proposal" label={t('Proposal')} className="gap-8">
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
