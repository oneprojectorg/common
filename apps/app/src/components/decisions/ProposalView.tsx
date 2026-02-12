'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { getPublicUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import { formatCurrency, formatDate } from '@/utils/formatting';
import type { RouterOutput } from '@op/api';
import { trpc } from '@op/api/client';
import { parseProposalData } from '@op/common/client';
import type { SupportedLocale } from '@op/common/client';
import { Avatar } from '@op/ui/Avatar';
import { Header1 } from '@op/ui/Header';
import { Link } from '@op/ui/Link';
import { Surface } from '@op/ui/Surface';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { Heart, MessageCircle } from 'lucide-react';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { LuBookmark } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { DocumentNotAvailable } from './DocumentNotAvailable';
import { ProposalAttachmentViewList } from './ProposalAttachmentViewList';
import { ProposalContentRenderer } from './ProposalContentRenderer';
import { ProposalHtmlContent } from './ProposalHtmlContent';
import { ProposalViewLayout } from './ProposalViewLayout';
import { TranslateBanner } from './TranslateBanner';
import type { ProposalTemplateSchema } from './proposalEditor/compileProposalSchema';

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

  // Parse proposal data using shared utility
  const {
    title: originalTitle,
    budget,
    category: originalCategory,
  } = parseProposalData(currentProposal.proposalData);

  // Use translated values when available, otherwise originals
  const title = translatedHtmlContent?.translated.title ?? originalTitle;
  const category =
    translatedHtmlContent?.translated.category ?? originalCategory;

  const resolvedHtmlContent =
    translatedHtmlContent?.translated ?? currentProposal.htmlContent;
  const proposalTemplate =
    (currentProposal.proposalTemplate as ProposalTemplateSchema) ?? null;

  // Legacy proposals store HTML under a single "default" key with no collab doc.
  // Render them directly instead of going through the template-driven renderer.
  const legacyHtml = resolvedHtmlContent?.default as string | undefined;

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
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          <div className="space-y-4">
            {/* Title */}
            <Header1 className="font-serif text-title-lg">
              {title || t('Untitled Proposal')}
            </Header1>

            {/* Translation attribution */}
            {translatedHtmlContent && (
              <p className="text-sm text-neutral-gray3">
                {t('Translated from {language}', {
                  language: sourceLanguageName,
                })}{' '}
                &middot;{' '}
                <Link
                  onPress={handleViewOriginal}
                  className="text-sm font-semibold"
                >
                  {t('View original')}
                </Link>
              </p>
            )}

            <div className="space-y-6">
              {/* Metadata Row */}
              <div className="flex flex-wrap gap-4 sm:flex-row sm:items-center">
                {category && (
                  <TagGroup className="max-w-full">
                    <Tag className="max-w-full sm:max-w-96 sm:rounded-sm">
                      <span className="truncate">{category}</span>
                    </Tag>
                  </TagGroup>
                )}
                {budget && (
                  <span className="font-serif text-title-base text-neutral-black">
                    {formatCurrency(budget.value, undefined, budget.currency)}
                  </span>
                )}
              </div>

              {/* Author and submission info */}
              <div className="flex items-center gap-2">
                {currentProposal.submittedBy && (
                  <>
                    <Avatar
                      placeholder={
                        currentProposal.submittedBy.name ||
                        currentProposal.submittedBy.slug ||
                        'U'
                      }
                      className="size-8"
                    >
                      {currentProposal.submittedBy.avatarImage?.name ? (
                        <Image
                          src={
                            getPublicUrl(
                              currentProposal.submittedBy.avatarImage.name,
                            ) ?? ''
                          }
                          alt={
                            currentProposal.submittedBy.name ||
                            currentProposal.submittedBy.slug ||
                            ''
                          }
                          fill
                          className="aspect-square object-cover"
                        />
                      ) : null}
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-base text-neutral-black">
                        {currentProposal.submittedBy.name ||
                          currentProposal.submittedBy.slug}
                      </span>
                      <span className="text-sm text-neutral-charcoal">
                        {t('Submitted on')}{' '}
                        {formatDate(currentProposal.createdAt)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Engagement Stats */}
              <div className="flex items-center gap-4 border-t border-b py-4 text-sm text-neutral-gray4">
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4" />
                  <span>
                    {currentProposal.likesCount || 0} {t('Likes')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>
                    {currentProposal.commentsCount || 0}{' '}
                    {(currentProposal.commentsCount || 0) !== 1
                      ? t('Comments')
                      : t('Comment')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <LuBookmark className="size-4" />
                  <span>
                    {currentProposal.followersCount || 0}{' '}
                    {(currentProposal.followersCount || 0) !== 1
                      ? t('Followers')
                      : t('Follower')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Proposal Content */}
          {legacyHtml ? (
            <ProposalHtmlContent html={legacyHtml} />
          ) : resolvedHtmlContent ? (
            <ProposalContentRenderer
              proposalTemplate={proposalTemplate}
              htmlContent={resolvedHtmlContent}
            />
          ) : (
            <DocumentNotAvailable />
          )}

          {/* Attachments Section */}
          {currentProposal.attachments &&
            currentProposal.attachments.length > 0 && (
              <div className="border-t pt-8">
                <h3 className="mb-4 text-lg font-semibold text-neutral-charcoal">
                  {t('Attachments')}
                </h3>
                <ProposalAttachmentViewList
                  attachments={currentProposal.attachments}
                />
              </div>
            )}

          {/* Comments Section */}
          <div className="mt-12" ref={commentsContainerRef}>
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
