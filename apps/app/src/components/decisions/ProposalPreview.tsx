'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { formatDate } from '@/utils/formatting';
import { ProposalStatus, Visibility } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalSelection,
  type ProposalTemplateSchema,
  normalizeProposalCategories,
  parseTranslatedMeta,
} from '@op/common/client';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { AnimatedCount } from '@op/sense/AnimatedCount';
import { Header1, Header3 } from '@op/sense/Header';
import { Spinner } from '@op/sense/Spinner';
import { StatusBadge } from '@op/sense/StatusBadge';
import { Tag, TagGroup } from '@op/sense/TagGroup';
import { Toggle } from '@op/sense/Toggle';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import {
  LuBadgeCheck,
  LuBookmark,
  LuEyeOff,
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
 * Like / follow state + handlers. With it the engagement counts become
 * toggles; without it the row is a static summary (as in the review panes).
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
  // Draft has its own banner above, so don't also badge it as hidden.
  const isHidden = !isDraft && proposal.visibility === Visibility.HIDDEN;

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

      {/* Figma "Proposal Header" (17924:77055): status row / header / engagement
          stacked at 24, with the header's own contents at 16. */}
      <div className="flex flex-col gap-6">
        {/* Status badges. Unlike ProposalCardView's single-badge
            `ProposalStatusBadge`, the header shows every applicable state at
            once, with the longer copy the design spells out. */}
        {(isHidden || proposal.isFlagged || selection) && (
          <div className="flex flex-wrap gap-2">
            {isHidden && (
              <StatusBadge variant="warning" icon={LuEyeOff}>
                {t('Hidden from public view')}
              </StatusBadge>
            )}
            {/* Only the author and admins ever receive a flagged proposal. */}
            {proposal.isFlagged && (
              <StatusBadge variant="alert" icon={LuFlag}>
                {t('Hidden from members after a moderation review')}
              </StatusBadge>
            )}
            {selection && (
              <StatusBadge variant="success" icon={LuBadgeCheck}>
                {t('Selected')}
              </StatusBadge>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* 30px serif at 300 — `text-headline` at this column's step. */}
          <Header1 className="text-headline font-light">
            {title || t('Untitled Proposal')}
          </Header1>

          {/* Translation attribution */}
          {translation && (
            <TranslationNotice
              sourceLanguageName={translation.sourceLanguageName}
              onViewOriginal={translation.onViewOriginal}
            />
          )}

          {/* Budget + categories share a row; either can appear alone. */}
          {(budget != null ||
            selection?.allocated != null ||
            categories.length > 0) && (
            <TagGroup className="max-w-full">
              {(budget != null || selection?.allocated != null) && (
                <Tag size="lg" variant="outline">
                  <BudgetDisplay
                    value={
                      selection?.allocated != null
                        ? selection.allocated
                        : budget
                    }
                  />
                </Tag>
              )}
              {selection?.allocated != null && budget && (
                <Tag size="lg">
                  {t('{amount} requested', {
                    amount: formatBudget(budget) ?? '',
                  })}
                </Tag>
              )}
              {categories.map((category) => (
                <Tag key={category} size="lg">
                  {category}
                </Tag>
              ))}
            </TagGroup>
          )}

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
                    <span className="text-base">
                      {proposal.submittedBy.name || proposal.submittedBy.slug}
                    </span>
                  ) : (
                    <NavLink
                      href={`/profile/${proposal.submittedBy.slug}`}
                      // Without this it falls through to the browser's ring.
                      className="w-fit rounded-sm text-base font-strong text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {proposal.submittedBy.name || proposal.submittedBy.slug}
                    </NavLink>
                  )}
                  {!isDraft && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
        </div>

        <EngagementRow proposal={proposal} engagement={engagement} />
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
          <Header3 className="mb-4 text-label">{t('Attachments')}</Header3>
          <ProposalAttachmentViewList attachments={proposal.attachments} />
        </div>
      )}
    </div>
  );
}

/**
 * Likes / followers / comments, hairline-ruled above and below (Figma's
 * "Engagement" row).
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

  // The noun is separate from the number so the number can animate on its own;
  // together they still read as the toggle's accessible name ("3 Likes").
  const likesNoun = likesCount === 1 ? t('Like') : t('Likes');
  const followersNoun = followersCount === 1 ? t('Follower') : t('Followers');
  const commentsNoun = commentsCount === 1 ? t('Comment') : t('Comments');

  return (
    <div className="flex items-center gap-2 border-t border-b py-2 text-sm text-muted-foreground">
      <EngagementToggle
        icon={LuHeart}
        count={likesCount}
        noun={likesNoun}
        pressed={engagement?.isLiked}
        onPressedChange={engagement?.onLike}
      />
      <EngagementToggle
        icon={LuBookmark}
        count={followersCount}
        noun={followersNoun}
        pressed={engagement?.isFollowing}
        onPressedChange={engagement?.onFollow}
      />
      {/* A link, not a toggle: jumping to the comments works for any viewer,
          signed in or not. `px-2` matches the ghost toggles' inset. */}
      <ButtonLink
        href={`#${PROPOSAL_COMMENTS_ANCHOR_ID}`}
        variant="ghost"
        size="sm"
        className="px-2 text-muted-foreground hover:text-foreground"
      >
        <LuMessageCircle aria-hidden />
        <AnimatedCount value={commentsCount} /> {commentsNoun}
      </ButtonLink>
    </div>
  );
}

/**
 * One engagement stat. Interactive when a handler is supplied, otherwise plain
 * text styled to match.
 *
 * Without a handler this must NOT stay a button: it would sit in the tab order
 * announcing "toggle button, not pressed" while doing nothing, and an
 * uncontrolled `pressed` would let a click flip the visual state without changing
 * anything. `aria-readonly` can't paper over that either — ARIA doesn't allow it
 * on `button`.
 */
function EngagementToggle({
  icon: Icon,
  count,
  noun,
  pressed,
  onPressedChange,
}: {
  icon: IconType;
  count: number;
  noun: string;
  pressed?: boolean;
  onPressedChange?: () => void;
}) {
  const isInteractive = Boolean(onPressedChange);
  const iconClassName = cn(pressed && 'fill-current');

  if (!isInteractive) {
    // `px-2` mirrors the ghost toggle's inset so both rows align identically.
    return (
      <span className="flex items-center gap-1 px-2">
        <Icon className={cn('size-4', iconClassName)} aria-hidden />
        <AnimatedCount value={count} /> {noun}
      </span>
    );
  }

  return (
    // The visible count is the accessible name; on/off comes from aria-pressed,
    // which base-ui sets from `pressed`.
    //
    // Not disabled while the mutation runs: the count and the pressed state are
    // already optimistic, and disabling the button you just pressed drops focus
    // to the body — mid-interaction, for a keyboard or screen reader user.
    <Toggle
      size="sm"
      variant="ghost"
      pressed={pressed ?? false}
      onPressedChange={onPressedChange}
    >
      <Icon className={iconClassName} aria-hidden />
      <AnimatedCount value={count} /> {noun}
    </Toggle>
  );
}
