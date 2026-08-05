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
import { Alert, AlertDescription } from '@op/sense/Alert';
import { Header1, Header3 } from '@op/sense/Header';
import { Spinner } from '@op/sense/Spinner';
import { Tag, TagGroup } from '@op/sense/TagGroup';
import { Toggle } from '@op/sense/Toggle';
import { cn } from '@op/sense/lib/utils';
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

import { Bullet } from '../Bullet';
import { ButtonLink } from '../ButtonLink';
import { ProfileAvatar } from '../ProfileAvatar';
import { BudgetDisplay, formatBudget } from './BudgetDisplay';
import { DocumentNotAvailable } from './DocumentNotAvailable';
import { ProposalAttachmentViewList } from './ProposalAttachmentViewList';
import { PROPOSAL_COMMENTS_ANCHOR_ID } from './ProposalComments';
import { ProposalContentRenderer } from './ProposalContentRenderer';
import { ProposalHtmlContent } from './ProposalHtmlContent';
import { TranslationNotice } from './TranslationNotice';
import { resolveProposalSystemFields } from './proposalContentUtils';

export type ProposalTranslation = {
  htmlContent: Record<string, string | string[]>;
  sourceLanguageName: string;
  onViewOriginal: () => void;
};

/**
 * Like / follow state + handlers. Supplying this turns the engagement row's
 * like and follow counts into toggles and links the comment count to the
 * comments section; omitting it leaves the row a static summary (the review
 * pane and review summary render the proposal without these affordances).
 */
export type ProposalEngagement = {
  isLiked: boolean;
  isFollowing: boolean;
  onLike: () => void;
  onFollow: () => void;
  /** Disables both toggles while a like/follow write is in flight. */
  isPending?: boolean;
};

export type ProposalPreviewProps = {
  proposal: Proposal;
  /** See {@link ProposalEngagement}. Absent → static counts. */
  engagement?: ProposalEngagement;
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
  engagement,
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
        <Alert variant="info">
          <AlertDescription>
            {t(
              'This proposal is currently in draft mode, only you and collaborators can access it.',
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {selection && (
          <div className="flex items-center gap-1 text-sm text-success">
            <LuCircleCheck className="size-4" />
            <span>{t('Selected')}</span>
          </div>
        )}

        {/* Only the author (+ collaborators) and admins ever receive a flagged
            proposal — everyone else has it filtered out server-side. */}
        {proposal.isFlagged && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <LuFlag className="size-4" />
            <span>{t('Hidden from members after a moderation review')}</span>
          </div>
        )}

        {/* `!text-title-lg` keeps the pre-migration 28px serif title — sense's
            `text-display` (Header1's default) is a different step. */}
        <Header1 className="font-serif !text-title-lg">
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
              <div className="flex flex-wrap items-end gap-2">
                <BudgetDisplay
                  value={selection.allocated}
                  className="font-serif text-title-base text-foreground"
                />
                {budget && (
                  <span className="text-sm text-muted-foreground">
                    {t('{amount} requested', {
                      amount: formatBudget(budget) ?? '',
                    })}
                  </span>
                )}
              </div>
            ) : (
              <BudgetDisplay
                value={budget}
                className="font-serif text-title-base text-foreground"
              />
            )}
            {categories.length > 0 && (
              <TagGroup className="max-w-full">
                {categories.map((category) => (
                  <Tag
                    key={category}
                    className="max-w-full sm:max-w-96 sm:rounded-md"
                  >
                    {category}
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
                    <span className="text-base text-foreground">
                      {proposal.submittedBy.name || proposal.submittedBy.slug}
                    </span>
                  ) : (
                    <NavLink
                      href={`/profile/${proposal.submittedBy.slug}`}
                      className="text-base text-foreground hover:no-underline"
                    >
                      {proposal.submittedBy.name || proposal.submittedBy.slug}
                    </NavLink>
                  )}
                  {!isDraft && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                      <span>
                        {t('Submitted on')} {formatDate(proposal.createdAt)}
                      </span>
                      {submissionMetaSuffix && (
                        <>
                          <Bullet />
                          {submissionMetaSuffix}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <EngagementRow proposal={proposal} engagement={engagement} />
        </div>
      </div>

      {headerBanner}

      {/* Proposal Content */}
      {documentState === 'pending' ? (
        <div className="flex justify-center py-8">
          <Spinner />
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
          {/* `!text-title-base` keeps the pre-migration 20px heading. */}
          <Header3 className="mb-4 font-sans !text-title-base">
            {t('Attachments')}
          </Header3>
          <ProposalAttachmentViewList attachments={proposal.attachments} />
        </div>
      )}
    </div>
  );
}

/**
 * Likes / followers / comments, hairline-ruled above and below (Figma's
 * "Engagement" row). With `engagement` the like and follow counts are toggles
 * and the comment count jumps to the comments section; without it the same
 * three counts render as plain text.
 */
function EngagementRow({
  proposal,
  engagement,
}: {
  proposal: Proposal;
  engagement?: ProposalEngagement;
}) {
  const t = useTranslations();

  const likesCount = proposal.likesCount || 0;
  const followersCount = proposal.followersCount || 0;
  const commentsCount = proposal.commentsCount || 0;

  const likesLabel = `${likesCount} ${likesCount === 1 ? t('Like') : t('Likes')}`;
  const followersLabel = `${followersCount} ${
    followersCount === 1 ? t('Follower') : t('Followers')
  }`;
  const commentsLabel = `${commentsCount} ${
    commentsCount === 1 ? t('Comment') : t('Comments')
  }`;

  return (
    <div
      className={cn(
        'flex items-center gap-1 border-t border-b py-2 text-sm text-muted-foreground',
        // Ghost toggles inset their content by 8px at `sm`; pull the row by the
        // same amount so the first icon lines up with the title above it.
        engagement && '-ms-2',
      )}
    >
      {engagement ? (
        <>
          {/* The visible count doubles as each toggle's accessible name; the
              on/off state comes from aria-pressed, which base-ui sets. */}
          <Toggle
            size="sm"
            variant="ghost"
            pressed={engagement.isLiked}
            onPressedChange={engagement.onLike}
            disabled={engagement.isPending}
          >
            <LuHeart
              className={cn(engagement.isLiked && 'fill-current')}
              aria-hidden
            />
            {likesLabel}
          </Toggle>
          <Toggle
            size="sm"
            variant="ghost"
            pressed={engagement.isFollowing}
            onPressedChange={engagement.onFollow}
            disabled={engagement.isPending}
          >
            <LuBookmark
              className={cn(engagement.isFollowing && 'fill-current')}
              aria-hidden
            />
            {followersLabel}
          </Toggle>
          {/* A link, not a toggle — `px-2` keeps its inset matching the ghost
              toggles beside it. */}
          <ButtonLink
            href={`#${PROPOSAL_COMMENTS_ANCHOR_ID}`}
            variant="ghost"
            size="sm"
            className="px-2 text-muted-foreground hover:text-foreground"
          >
            <LuMessageCircle aria-hidden />
            {commentsLabel}
          </ButtonLink>
        </>
      ) : (
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <LuHeart className="size-4" aria-hidden />
            {likesLabel}
          </span>
          <span className="flex items-center gap-1">
            <LuBookmark className="size-4" aria-hidden />
            {followersLabel}
          </span>
          <span className="flex items-center gap-1">
            <LuMessageCircle className="size-4" aria-hidden />
            {commentsLabel}
          </span>
        </div>
      )}
    </div>
  );
}
