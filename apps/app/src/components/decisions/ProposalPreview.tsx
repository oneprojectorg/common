'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { formatDate } from '@/utils/formatting';
import { ProposalStatus } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalSelection,
  type ProposalTemplateSchema,
  normalizeProposalCategories,
  parseTranslatedMeta,
} from '@op/common/client';
import { AlertBanner } from '@op/ui/AlertBanner';
import { Header1, Header3 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import type { ReactNode } from 'react';
import {
  LuBookmark,
  LuCircleCheck,
  LuFlag,
  LuHeart,
  LuMessageCircle,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link as NavLink } from '@/lib/i18n/routing';

import { ProfileAvatar } from '../ProfileAvatar';
import { AllocatedBudgetDisplay, BudgetDisplay } from './BudgetDisplay';
import { DocumentNotAvailable } from './DocumentNotAvailable';
import { ProposalAttachmentViewList } from './ProposalAttachmentViewList';
import { ProposalContentRenderer } from './ProposalContentRenderer';
import { ProposalHtmlContent } from './ProposalHtmlContent';
import { TranslationNotice } from './TranslationNotice';
import { resolveProposalSystemFields } from './proposalContentUtils';

export type ProposalTranslation = {
  htmlContent: Record<string, string | string[]>;
  sourceLanguageName: string;
  onViewOriginal: () => void;
};

export type ProposalPreviewProps = {
  proposal: Proposal;
  /** Selection record from the latest confirmed result, if any. */
  selection?: ProposalSelection | null;
  /** When set, overrides proposal content with translated HTML and shows attribution */
  translation?: ProposalTranslation;
  /** Rendered inline after the "Submitted on {date}" line, separated by a bullet. */
  submissionMetaSuffix?: ReactNode;
  /** Rendered between the header section and the proposal body. */
  headerBanner?: ReactNode;
  /**
   * Drives the body region when the collaboration document can't be rendered
   * yet. `'pending'` shows a loading state (still fetching/propagating),
   * `'error'` shows the "content not found" fallback, `'ready'` (default)
   * renders whatever content is present. Defaults to `'ready'` so callers that
   * don't track document loading (e.g. the review pane) are unaffected.
   */
  documentState?: 'ready' | 'pending' | 'error';
};

export function ProposalPreview({
  proposal,
  selection,
  translation,
  submissionMetaSuffix,
  headerBanner,
  documentState = 'ready',
}: ProposalPreviewProps) {
  const t = useTranslations();
  const canLinkToProfile = useCanLinkToProfile();

  const proposalTemplate =
    (proposal.proposalTemplate as ProposalTemplateSchema) ?? null;

  const isDraft = proposal.status === ProposalStatus.DRAFT;

  const {
    title: originalTitle,
    budget,
    budgetCurrency,
    category: originalCategory,
  } = resolveProposalSystemFields(proposal);

  const rawHtmlContent = translation?.htmlContent ?? proposal.htmlContent;
  // Filter to only string values — array fields (e.g. category) are system
  // fields handled separately and not passed to the content renderer.
  const htmlContent = rawHtmlContent
    ? Object.fromEntries(
        Object.entries(rawHtmlContent).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : null;
  const title = (translation?.htmlContent.title as string) ?? originalTitle;
  const categories = translation?.htmlContent.category
    ? normalizeProposalCategories(translation.htmlContent.category)
    : normalizeProposalCategories(originalCategory);
  const translatedMeta = translation
    ? parseTranslatedMeta(translation.htmlContent)
    : null;

  // Legacy proposals store HTML under a single "default" key with no collab doc.
  // Render them directly instead of going through the template-driven renderer.
  const legacyHtml = htmlContent?.default as string | undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Draft mode banner */}
      {isDraft && (
        <AlertBanner intent="default" variant="banner">
          {t(
            'This proposal is currently in draft mode, only you and collaborators can access it.',
          )}
        </AlertBanner>
      )}

      <div className="space-y-4">
        {selection && (
          <div className="flex items-center gap-1 text-sm text-functional-green">
            <LuCircleCheck className="size-4" />
            <span>{t('Selected')}</span>
          </div>
        )}

        {/* Only the author (+ collaborators) and admins ever receive a flagged
            proposal — everyone else has it filtered out server-side. */}
        {proposal.isFlagged && (
          <div className="flex items-center gap-1 text-sm text-functional-red">
            <LuFlag className="size-4" />
            <span>{t('Hidden from members after a moderation review')}</span>
          </div>
        )}

        <Header1 className="font-serif text-title-lg">
          {title || t('Untitled Proposal')}
        </Header1>

        {/* Translation attribution */}
        {translation && (
          <TranslationNotice
            sourceLanguageName={translation.sourceLanguageName}
            onViewOriginal={translation.onViewOriginal}
          />
        )}

        <div className="space-y-6">
          {/* Budget + Categories — stacked, matching the proposal editor layout */}
          <div className="flex flex-col items-start gap-4">
            {selection?.allocated != null ? (
              <AllocatedBudgetDisplay
                allocated={selection.allocated}
                requested={budget}
                fallbackCurrency={budgetCurrency}
                amountClassName="font-serif text-title-base text-neutral-black"
              />
            ) : (
              <BudgetDisplay
                value={budget}
                fallbackCurrency={budgetCurrency}
                className="font-serif text-title-base text-neutral-black"
              />
            )}
            {categories.length > 0 && (
              <TagGroup className="max-w-full">
                {categories.map((category) => (
                  <Tag
                    key={category}
                    className="max-w-full sm:max-w-96 sm:rounded-md"
                  >
                    <span className="truncate">{category}</span>
                  </Tag>
                ))}
              </TagGroup>
            )}
          </div>

          {/* Author and submission info */}
          <div className="flex items-center gap-2">
            {proposal.submittedBy && (
              <>
                <ProfileAvatar
                  profile={proposal.submittedBy}
                  withLink={!proposal.submittedBy.isAnonymous}
                  className="size-8"
                />
                <div className="flex flex-col">
                  {proposal.submittedBy.isAnonymous || !canLinkToProfile ? (
                    <span className="text-base text-neutral-black">
                      {proposal.submittedBy.name || proposal.submittedBy.slug}
                    </span>
                  ) : (
                    <NavLink
                      href={`/profile/${proposal.submittedBy.slug}`}
                      className="text-base text-neutral-black hover:no-underline"
                    >
                      {proposal.submittedBy.name || proposal.submittedBy.slug}
                    </NavLink>
                  )}
                  {!isDraft && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-charcoal">
                      <span>
                        {t('Submitted on')} {formatDate(proposal.createdAt)}
                      </span>
                      {submissionMetaSuffix && (
                        <>
                          <span className="text-neutral-gray4">•</span>
                          {submissionMetaSuffix}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Engagement Stats */}
          <div className="flex items-center gap-4 border-t border-b py-4 text-sm text-neutral-gray4">
            <div className="flex items-center gap-1">
              <LuHeart className="h-4 w-4" />
              <span>
                {proposal.likesCount || 0} {t('Likes')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <LuMessageCircle className="h-4 w-4" />
              <span>
                {proposal.commentsCount || 0}{' '}
                {(proposal.commentsCount || 0) !== 1
                  ? t('Comments')
                  : t('Comment')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <LuBookmark className="size-4" />
              <span>
                {proposal.followersCount || 0}{' '}
                {(proposal.followersCount || 0) !== 1
                  ? t('Followers')
                  : t('Follower')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {headerBanner}

      {/* Proposal Content */}
      {documentState === 'pending' ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : documentState === 'error' ? (
        <DocumentNotAvailable className="py-4" />
      ) : legacyHtml ? (
        <ProposalHtmlContent html={legacyHtml} />
      ) : htmlContent && proposalTemplate ? (
        <ProposalContentRenderer
          proposalTemplate={proposalTemplate}
          htmlContent={htmlContent}
          location={proposal.proposalData?.location}
          translatedMeta={translatedMeta}
        />
      ) : null}

      {/* Attachments Section */}
      {proposal.attachments && proposal.attachments.length > 0 && (
        <div className="border-t pt-8">
          <Header3 className="mb-4 font-sans">{t('Attachments')}</Header3>
          <ProposalAttachmentViewList attachments={proposal.attachments} />
        </div>
      )}
    </div>
  );
}
