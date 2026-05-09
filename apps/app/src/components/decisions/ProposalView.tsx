'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  ProposalReviewRequestState,
  type ProposalTranslation,
  type SupportedLocale,
} from '@op/common/client';
import { SplitPane } from '@op/ui/SplitPane';
import { useLocale } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { type ReactNode, useCallback, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalComments } from './ProposalComments';
import { ProposalPreview } from './ProposalPreview';
import { ProposalRevisionSubmittedPanel } from './ProposalRevisionSubmittedPanel';
import { ProposalViewLayout } from './ProposalViewLayout';
import { RevisedOnBadge } from './Review/AuthorRevisionNote';
import { TranslateBanner } from './TranslateBanner';
import { proposalEditorReviewRevisionParser } from './proposalEditor/proposalEditorAsideParams';

export function ProposalView({
  proposal: initialProposal,
  canSeeRevisions,
  backHref,
}: {
  proposal: Proposal;
  canSeeRevisions: boolean;
  backHref: string;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const { data: proposal } = trpc.decision.getProposal.useQuery({
    profileId: initialProposal.profileId,
  });

  // Safety check - fallback to initial data if query returns undefined
  const currentProposal = proposal || initialProposal;

  // Use relationship mutations hook for like/follow functionality
  const {
    isLiked: isLikedByUser,
    isFollowed: isFollowedByUser,
    isLoading,
    handleLike,
    handleFollow,
  } = useRelationshipMutations({
    targetProfileId: currentProposal.profileId,
  });

  // Check if current user can edit (submitter or org admin)
  const canEdit = currentProposal.isEditable ?? false;

  // Generate edit href
  const editHref = canEdit
    ? `${backHref}/proposal/${currentProposal.profileId}/edit`
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

  // TODO: replace `locale !== 'en'` with a source-language check once proposals carry their own locale
  const showBanner =
    locale !== 'en' && !bannerDismissed && !translatedHtmlContent;

  // Most recently responded revision (if any) — drives the "Revised on"
  // badge shown inline in the submitter metadata row.
  const latestResponse = submittedRevisions[0]?.revisionRequest ?? null;

  const proposalBody: ReactNode = (
    <>
      <ProposalPreview
        proposal={currentProposal}
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
      onLike={handleLike}
      onFollow={handleFollow}
      isLiked={isLikedByUser}
      isFollowing={isFollowedByUser}
      isLoading={isLoading}
      editHref={editHref}
      canEdit={canEdit}
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
        <div className="flex-1 px-6 py-8">
          <div className="mx-auto flex max-w-xl flex-col gap-8">
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
