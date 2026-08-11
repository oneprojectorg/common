'use client';

import { useContentNeedsTranslation } from '@/hooks/useContentNeedsTranslation';
import { useProposalEngagement } from '@/hooks/useProposalEngagement';
import { useTrackPageView } from '@/hooks/useTrackPageView';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  ProposalReviewRequestState,
  type ProposalSelection,
  type ProposalTranslation,
  type SupportedLocale,
} from '@op/common/client';
import { SplitPane } from '@op/sense/SplitPane';
import { useLocale } from 'next-intl';
import { useQueryStates } from 'nuqs';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalComments } from './ProposalComments';
import { ProposalPreview } from './ProposalPreview';
import { ProposalRevisionSubmittedPanel } from './ProposalRevisionSubmittedPanel';
import { ProposalViewLayout } from './ProposalViewLayout';
import { RevisedOnBadge } from './Review/AuthorRevisionNote';
import { TranslateBanner } from './TranslateBanner';
import { proposalEditorReviewRevisionParser } from './proposalEditor/proposalEditorAsideParams';
import { getProposalDetectionText } from './translationDetectionText';

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
  canSeeRevisions,
  decisionRoot,
  selection,
}: {
  proposal: Proposal;
  canSeeRevisions: boolean;
  decisionRoot: string;
  selection: ProposalSelection | null;
}) {
  const t = useTranslations();
  const locale = useLocale();

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
    canEngage: currentProposal.access?.submitProposals === true,
  });

  // Check if current user can edit (submitter or org admin)
  const canEdit = currentProposal.isEditable ?? false;

  const backHref = `${decisionRoot}/current`;
  const editHref = canEdit
    ? `${decisionRoot}/proposal/${currentProposal.profileId}/edit`
    : undefined;

  const [{ reviewRevision }, setQueryState] = useQueryStates({
    reviewRevision: proposalEditorReviewRevisionParser,
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
      { enabled: canSeeRevisions, throwOnError: false, retry: false },
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

  const [bannerDismissed, setBannerDismissed] = useState(false);

  /** Holds the translated HTML content + source locale after a successful translation request */
  const [translatedHtmlContent, setTranslatedHtmlContent] = useState<{
    translated: ProposalTranslation;
    sourceLocale: string;
  } | null>(null);

  const translateMutation = trpc.translation.translateProposal.useMutation({
    onSuccess: (data) => {
      setTranslatedHtmlContent({
        translated: data.translated,
        sourceLocale: data.sourceLocale,
      });
    },
  });

  const handleTranslate = useCallback(() => {
    translateMutation.mutate({
      profileId: currentProposal.profileId,
      targetLocale: locale as SupportedLocale,
    });
  }, [translateMutation, currentProposal.profileId, locale]);

  const handleViewOriginal = () => setTranslatedHtmlContent(null);

  /** Use the browser's Intl API to get localized language names — no translation keys needed */
  const languageNames = new Intl.DisplayNames([locale], { type: 'language' });
  const getLanguageName = (langCode: string) =>
    languageNames.of(langCode) ?? langCode;

  const sourceLanguageName = translatedHtmlContent
    ? getLanguageName(
        translatedHtmlContent.sourceLocale.toLowerCase().split('-')[0] ?? '',
      )
    : '';

  const targetLanguageName = getLanguageName(locale);

  // Only offer translation when the proposal's own content is in a language
  // other than the reader's locale — no badge for same-language proposals.
  const detectionText = useMemo(
    () => getProposalDetectionText(currentProposal),
    [currentProposal],
  );
  const needsTranslation = useContentNeedsTranslation(detectionText);

  const showBanner =
    needsTranslation && !bannerDismissed && !translatedHtmlContent;

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
        translation={
          translatedHtmlContent
            ? {
                htmlContent: translatedHtmlContent.translated,
                sourceLanguageName,
                onViewOriginal: handleViewOriginal,
              }
            : undefined
        }
        submissionMetaSuffix={
          latestResponse?.respondedAt ? (
            <RevisedOnBadge respondedAt={latestResponse.respondedAt} />
          ) : undefined
        }
      />

      <ProposalComments proposal={currentProposal} />
    </>
  );

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
      // `access.admin` and on the proposal having left draft.
      moderationProposal={currentProposal}
      revisionToggle={
        firstRevisionRequestId
          ? {
              onToggle: toggleRevisionRequest,
              isActive: Boolean(activeRevisionRequest),
            }
          : undefined
      }
    >
      {activeRevisionRequest ? (
        <SplitPane className="mx-auto w-full max-w-6xl">
          <SplitPane.Pane id="proposal" label={t('Proposal')} className="gap-8">
            {proposalBody}
          </SplitPane.Pane>
          <SplitPane.Pane
            id="feedback"
            label={t('Revision feedback')}
            className="bg-white"
            unpadded
          >
            <ProposalRevisionSubmittedPanel
              revisionRequest={activeRevisionRequest}
            />
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
          onDismiss={() => setBannerDismissed(true)}
          isTranslating={translateMutation.isPending}
          languageName={targetLanguageName}
        />
      )}
    </ProposalViewLayout>
  );
}
