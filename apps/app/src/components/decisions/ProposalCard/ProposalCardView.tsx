'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { useProposalEngagement } from '@/hooks/useProposalEngagement';
import { getPublicUrl } from '@/utils';
import { ProposalStatus, Visibility } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTemplateSchema,
  normalizeProposalCategories,
} from '@op/common/client';
import { match } from '@op/core';
import { ProposalCard as SenseProposalCard } from '@op/sense/ProposalCard';
import { StatusBadge } from '@op/sense/StatusBadge';
import { cn } from '@op/sense/lib/utils';
import type { ComponentProps, ReactNode } from 'react';
import { LuCircleX } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { formatBudget } from '../BudgetDisplay';
import { useCardTranslation } from '../ProposalTranslationContext';
import {
  getProposalContentPreview,
  resolveProposalSystemFields,
} from '../proposalContentUtils';
import { useProposalReviewDecoration } from '../proposalReviewDecoration';

/**
 * Maps the app's `Proposal` into the presentational values the sense
 * `ProposalCard` composite expects (title / budget / category tags / authors /
 * preview), applying any per-card translation. Shared by every proposal-card
 * surface so the mapping lives in one place.
 */
export function useProposalCardData(proposal: Proposal) {
  const t = useTranslations();
  const canLinkToProfile = useCanLinkToProfile();
  const cardTranslation = useCardTranslation(proposal.profileId);
  const { title, budget, category } = resolveProposalSystemFields(proposal);

  const titleText =
    cardTranslation?.title ??
    (title || proposal.profile.name || t('Untitled Proposal'));

  const budgetText = formatBudget(budget) ?? undefined;

  const displayCategories = cardTranslation?.category
    ? cardTranslation.category
    : normalizeProposalCategories(category);

  // Link the author to their profile only when linking is allowed and the
  // author isn't anonymous.
  const authorHref =
    proposal.submittedBy &&
    canLinkToProfile &&
    !proposal.submittedBy.isAnonymous
      ? `/profile/${proposal.submittedBy.slug}`
      : undefined;
  const authors = proposal.submittedBy
    ? [
        {
          name: proposal.submittedBy.name || proposal.submittedBy.slug || '',
          avatarSrc: proposal.submittedBy.avatarImage?.name
            ? (getPublicUrl(proposal.submittedBy.avatarImage.name) ?? undefined)
            : undefined,
          href: authorHref,
        },
      ]
    : undefined;

  const translatedPreview = cardTranslation?.preview;
  const previewText =
    translatedPreview === undefined
      ? (proposal.previewText ??
        getProposalContentPreview(
          proposal.documentContent,
          (proposal.proposalTemplate as ProposalTemplateSchema) ?? undefined,
        ))
      : undefined;
  const description = (translatedPreview ?? previewText) || undefined;

  return { titleText, budgetText, displayCategories, authors, description };
}

/** The state that says who can see this proposal at all, if any. */
const restrictionOf = ({ status, visibility, isFlagged }: Proposal) => {
  // DRAFT wins over HIDDEN: a draft created in a hidden-by-default phase
  // should still read as "Draft" to its author, not "Hidden".
  if (status === ProposalStatus.DRAFT) {
    return 'draft';
  }

  // A flagged proposal is hidden from members pending a moderation verdict.
  if (isFlagged) {
    return 'flagged';
  }

  return visibility === Visibility.HIDDEN ? 'hidden' : undefined;
};

/** Restricted visibility on its own, for surfaces the candidacy states don't fit. */
export const ProposalRestrictionBadge = ({
  proposal,
}: {
  proposal: Proposal;
}) => {
  const t = useTranslations();

  return match(restrictionOf(proposal), {
    draft: <StatusBadge variant="inactive">{t('Draft')}</StatusBadge>,
    flagged: <StatusBadge variant="alert">{t('Flagged')}</StatusBadge>,
    hidden: <StatusBadge variant="warning">{t('Hidden')}</StatusBadge>,
    _: null,
  });
};

/** Proposal status/visibility surfaced as the composite's `headerBadge`. */
export const ProposalStatusBadge = ({ proposal }: { proposal: Proposal }) => {
  const t = useTranslations();
  const { status, isSelected } = proposal;

  // Restricted visibility outranks the candidacy states below it.
  if (restrictionOf(proposal)) {
    return <ProposalRestrictionBadge proposal={proposal} />;
  }

  // "Selected" is driven by results selection, not the editable `status`.
  if (isSelected) {
    return <StatusBadge variant="success">{t('Selected')}</StatusBadge>;
  }

  return match(status, {
    [ProposalStatus.APPROVED]: (
      <StatusBadge variant="success">{t('Shortlisted')}</StatusBadge>
    ),
    [ProposalStatus.REJECTED]: (
      <StatusBadge variant="alert" icon={LuCircleX}>
        {t('Not advanced')}
      </StatusBadge>
    ),
    _: null,
  });
};

export interface ProposalCardViewProps extends Omit<
  ComponentProps<'div'>,
  'title' | 'children'
> {
  proposal: Proposal;
  /** Detail link — when set the title becomes the card's stretched primary link. */
  href?: string;
  /** Utility-corner slot (menu / select toggle). */
  aside?: ReactNode;
  /** Action row (Revise / Edit / Delete / Read full proposal). */
  actions?: ReactNode;
  /** Show the engagement counts (likes / follows / comments). */
  showMetrics?: boolean;
  /**
   * Makes the like and follow counts pressable. The counts are the controls —
   * there is no separate Like/Follow pair repeating the same two icons. Ignored
   * for viewers who can't act (anonymous, or no engagement access), who get the
   * plain numbers.
   */
  canEngage?: boolean;
  /** Render the "Revision requested" badge instead of the status badge. */
  revisionRequested?: boolean;
  /**
   * Badge above the title. Defaults to `ProposalStatusBadge`; pass `null` for
   * no badge, or another one where the default's states don't fit.
   */
  headerBadge?: ReactNode;
  /** Selected treatment (teal border + title) for vote/selection phases. */
  selected?: boolean;
  /** Running vote total; renders the "N Total Votes" row when set. */
  totalVotes?: number;
  /** Awarded badge for funded proposals — shown on the right of the votes row. */
  awardedLabel?: ReactNode;
  /** Left of the status row — typically a `StatusBadge`. */
  status?: ReactNode;
  /**
   * Right of the status row (e.g. a "3 Reviewed" count). Left unset, a review
   * surface's decoration provider fills it (see `useProposalReviewDecoration`).
   */
  reviewedLabel?: ReactNode;
}

/**
 * The standard decisions proposal card: maps a `Proposal` onto the sense
 * `ProposalCard` composite. Used by the grid, results, ballot, and map list
 * surfaces — each passes the slots (`aside`, `actions`) and flags it needs.
 * Extra `div` props (onClick / role / aria-*) pass through to the card root so
 * callers can make the whole card an interactive vote target.
 */
export const ProposalCardView = ({
  proposal,
  href,
  aside,
  actions,
  showMetrics = false,
  canEngage = false,
  revisionRequested = false,
  // A default parameter, so `null` reaches the card as "no badge" while an
  // absent prop still gets the standard one.
  headerBadge = <ProposalStatusBadge proposal={proposal} />,
  selected,
  totalVotes,
  awardedLabel,
  status,
  reviewedLabel,
  className,
  ...rest
}: ProposalCardViewProps) => {
  const t = useTranslations();
  const { titleText, budgetText, displayCategories, authors, description } =
    useProposalCardData(proposal);
  const engagement = useProposalEngagement({ proposal, canEngage });
  // Empty unless a review surface provides it; an explicit slot always wins.
  const decoration = useProposalReviewDecoration(proposal.id);

  const tags =
    revisionRequested || displayCategories.length === 0
      ? undefined
      : displayCategories;

  // Labels are passed rather than left to the card's English defaults: they're
  // the metrics' accessible names.
  const metrics = showMetrics
    ? {
        likes: {
          count: proposal.likesCount || 0,
          label: t('Likes'),
          ...(engagement && {
            active: engagement.isLiked,
            onClick: engagement.onLike,
          }),
        },
        bookmarks: {
          count: proposal.followersCount || 0,
          label: t('Followers'),
          // No `onFollow` for an author — the count stays, the press goes.
          ...(engagement?.onFollow && {
            active: engagement.isFollowed,
            onClick: engagement.onFollow,
          }),
        },
        comments: { count: proposal.commentsCount || 0, label: t('Comments') },
      }
    : undefined;

  const badge = revisionRequested ? (
    <StatusBadge variant="revision">{t('Revision requested')}</StatusBadge>
  ) : (
    headerBadge
  );

  return (
    <SenseProposalCard
      title={titleText}
      href={href}
      linkComponent={Link}
      className={className}
      selected={selected}
      headerBadge={badge}
      aside={aside}
      budget={budgetText}
      tags={tags}
      authors={authors}
      description={description}
      metrics={metrics}
      totalVotes={totalVotes}
      totalVotesLabel={t('Total Votes')}
      awardedLabel={awardedLabel}
      status={status}
      reviewedLabel={reviewedLabel ?? decoration.reviewedLabel}
      actions={actions}
      {...rest}
    />
  );
};

/**
 * Compact proposal card for confirm modals and selection lists: title, budget,
 * category tags, and author only — no preview, status, or actions.
 */
export const ProposalMiniCard = ({
  proposal,
  className,
}: {
  proposal: Proposal;
  className?: string;
}) => {
  const { titleText, budgetText, displayCategories, authors } =
    useProposalCardData(proposal);

  return (
    <SenseProposalCard
      title={titleText}
      budget={budgetText}
      tags={displayCategories.length > 0 ? displayCategories : undefined}
      authors={authors}
      className={cn('bg-muted p-4', className)}
    />
  );
};
