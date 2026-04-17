'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  ProposalReviewRequestState,
  type ProposalTranslation,
  type SupportedLocale,
} from '@op/common/client';
import { Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { useLocale } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { type ReactNode, useCallback, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { ProposalPreview } from './ProposalPreview';
import { ProposalRevisionSubmittedPanel } from './ProposalRevisionSubmittedPanel';
import { ProposalViewLayout } from './ProposalViewLayout';
import { RevisedOnBadge } from './Review/AuthorRevisionNote';
import { TranslateBanner } from './TranslateBanner';
import { proposalEditorReviewRevisionParser } from './proposalEditor/proposalEditorAsideParams';

export function ProposalView({
  proposal: initialProposal,
  backHref,
}: {
  proposal: Proposal;
  backHref: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const { data: proposal } = trpc.decision.getProposal.useQuery({
    profileId: initialProposal.profileId,
  });

  // Safety check - fallback to initial data if query returns undefined
  const currentProposal = proposal || initialProposal;

  // Get current user to check edit permissions
  const { user } = useUser();

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

  // Revision request toggle. The backend filters the list down to the roles
  // allowed to see it (author / admin / reviewer) — users without permission
  // receive an empty array and never see the toggle.
  const [{ reviewRevision }, setQueryState] = useQueryStates({
    reviewRevision: proposalEditorReviewRevisionParser,
  });

  // The view panel is "Revision submitted" — only surface entries the author
  // has already responded to. Pending requests are handled by the editor.
  const { data: revisionData } =
    trpc.decision.listProposalRevisionRequests.useQuery({
      proposalId: currentProposal.id,
      states: [ProposalReviewRequestState.RESUBMITTED],
    });

  const submittedRevisions = revisionData?.revisionRequests ?? [];

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

  // Get comments for the proposal using the posts API
  const { data: commentsData, isLoading: commentsLoading } =
    trpc.posts.getPosts.useQuery({
      profileId: currentProposal.profileId || undefined,
      parentPostId: null, // Get top-level comments only
      limit: 50,
      offset: 0,
      includeChildren: false,
    });

  const comments = commentsData || [];

  const { handleReactionClick } = usePostFeedActions();

  // Function to scroll to show comments after adding a new one
  const scrollToComments = useCallback(() => {
    if (commentsContainerRef.current) {
      setTimeout(() => {
        const container = commentsContainerRef.current;
        if (container) {
          container.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest',
          });
        }
      }, 100);
    }
  }, []);

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

      {/* Comments Section */}
      <div ref={commentsContainerRef}>
        <div className="border-t pt-8">
          <Header3 className="mb-6">
            {t('Comments')} ({comments.length})
          </Header3>

          {/* Comment Input */}
          <div className="mb-8">
            <Surface className="border-0 p-0 sm:border sm:p-4">
              <PostUpdate
                profileId={currentProposal.profileId || undefined}
                placeholder={`${t('Comment')}${user.currentProfile?.name ? ` as ${user.currentProfile?.name}` : ''}...`}
                label={t('Comment')}
                onSuccess={scrollToComments}
                proposalId={currentProposal.id}
                processInstanceId={currentProposal.processInstanceId}
              />
            </Surface>
          </div>

          {/* Comments Display */}
          {commentsLoading ? (
            <div
              className="py-8 text-center text-gray-500"
              role="status"
              aria-label={t('Loading comments')}
            >
              {t('Loading comments...')}
            </div>
          ) : comments.length > 0 ? (
            <div role="feed" aria-label={`${comments.length} comments`}>
              <PostFeed>
                {comments.map((comment, i) => (
                  <div key={comment.id}>
                    <PostItem
                      post={comment}
                      organization={null}
                      user={user}
                      withLinks={false}
                      onReactionClick={handleReactionClick}
                      className="sm:px-0"
                    />
                    {comments.length !== i + 1 && <hr className="my-4" />}
                  </div>
                ))}
              </PostFeed>
            </div>
          ) : (
            <div
              className="py-8 text-center text-gray-500"
              role="status"
              aria-label={t('No comments')}
            >
              {t('No comments yet. Be the first to comment!')}
            </div>
          )}
        </div>
      </div>
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
        <div className="mx-auto flex w-full max-w-[68rem] flex-1 items-start">
          <div className="flex min-w-0 basis-1/2 flex-col gap-8 border-r border-neutral-gray1 py-12 pr-12 pl-6 sm:pl-12">
            {proposalBody}
          </div>
          <div className="min-w-0 basis-1/2 bg-white">
            <ProposalRevisionSubmittedPanel
              revisionRequest={activeRevisionRequest}
            />
          </div>
        </div>
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
