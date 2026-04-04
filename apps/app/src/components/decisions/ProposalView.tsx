'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { useUser } from '@/utils/UserProvider';
import type { RouterOutput } from '@op/api';
import { trpc } from '@op/api/client';
import { parseTranslatedMeta } from '@op/common/client';
import type { SupportedLocale } from '@op/common/client';
import { Surface } from '@op/ui/Surface';
import { useLocale } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { ProposalPreview } from './ProposalPreview';
import { ProposalViewLayout } from './ProposalViewLayout';
import { TranslateBanner } from './TranslateBanner';
import { resolveProposalSystemFields } from './proposalContentUtils';

type Proposal = RouterOutput['decision']['getProposal'];

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
    translated: Record<string, string>;
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

  // Resolve system fields from pinned TipTap version (proposalData may be stale)
  const {
    title: originalTitle,
    budget,
    category: originalCategory,
  } = resolveProposalSystemFields(currentProposal);

  // Use translated category/title when available, otherwise original
  const title = translatedHtmlContent?.translated.title ?? originalTitle;
  const category =
    translatedHtmlContent?.translated.category ?? originalCategory;

  const resolvedHtmlContent =
    translatedHtmlContent?.translated ?? currentProposal.htmlContent;

  const translatedMeta = useMemo(
    () =>
      translatedHtmlContent
        ? parseTranslatedMeta(translatedHtmlContent.translated)
        : null,
    [translatedHtmlContent],
  );

  // TODO: replace `locale !== 'en'` with a source-language check once proposals carry their own locale
  const showBanner =
    locale !== 'en' && !bannerDismissed && !translatedHtmlContent;

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
    >
      {/* Content */}
      <div className="flex-1 px-6 py-8">
        <ProposalPreview
          proposal={currentProposal}
          title={title}
          budget={budget}
          category={category}
          htmlContent={resolvedHtmlContent}
          translatedMeta={translatedMeta}
          sourceLanguageName={
            translatedHtmlContent ? sourceLanguageName : undefined
          }
          onViewOriginal={handleViewOriginal}
        />

        {/* Comments Section */}
        <div className="mx-auto mt-12 max-w-xl" ref={commentsContainerRef}>
          <div className="border-t pt-8">
            <h3 className="mb-6 text-lg font-semibold text-neutral-charcoal">
              {t('Comments')} ({comments.length})
            </h3>

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
      </div>

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
