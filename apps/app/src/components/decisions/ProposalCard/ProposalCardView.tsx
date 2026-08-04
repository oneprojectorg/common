'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
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

import { Link, useTranslations } from '@/lib/i18n';

import { formatBudget } from '../BudgetDisplay';
import { useCardTranslation } from '../ProposalTranslationContext';
import {
  getProposalContentPreview,
  resolveProposalSystemFields,
} from '../proposalContentUtils';

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

/** Proposal status/visibility surfaced as the composite's `headerBadge`. */
export const ProposalStatusBadge = ({ proposal }: { proposal: Proposal }) => {
  const t = useTranslations();
  const { status, visibility, isSelected, isFlagged } = proposal;

  // DRAFT wins over HIDDEN: a draft created in a hidden-by-default phase
  // should still read as "Draft" to its author, not "Hidden".
  if (status === ProposalStatus.DRAFT) {
    return <StatusBadge variant="inactive">{t('Draft')}</StatusBadge>;
  }

  // A flagged proposal is hidden from members pending a moderation verdict.
  if (isFlagged) {
    return <StatusBadge variant="alert">{t('Flagged')}</StatusBadge>;
  }

  if (visibility === Visibility.HIDDEN) {
    return <StatusBadge variant="warning">{t('Hidden')}</StatusBadge>;
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
      <StatusBadge variant="inactive">{t('Not shortlisted')}</StatusBadge>
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
  /** Show display-only engagement counts (likes / follows / comments). */
  showMetrics?: boolean;
  /** Render the "Revision requested" badge instead of the status badge. */
  revisionRequested?: boolean;
  /** Show the proposal's status/visibility badge above the title. */
  showStatusBadge?: boolean;
  /** Selected treatment (teal border + title) for vote/selection phases. */
  selected?: boolean;
  /** Running vote total; renders the "N Total Votes" row when set. */
  totalVotes?: number;
  /** Allocated budget — replaces the requested budget tag when present. */
  allocated?: string | number | null;
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
  revisionRequested = false,
  showStatusBadge = true,
  selected,
  totalVotes,
  allocated,
  className,
  ...rest
}: ProposalCardViewProps) => {
  const t = useTranslations();
  const { titleText, budgetText, displayCategories, authors, description } =
    useProposalCardData(proposal);

  const tags =
    revisionRequested || displayCategories.length === 0
      ? undefined
      : displayCategories;

  const budget =
    allocated != null ? (formatBudget(allocated) ?? undefined) : budgetText;

  const metrics = showMetrics
    ? {
        likes: proposal.likesCount || 0,
        bookmarks: proposal.followersCount || 0,
        comments: proposal.commentsCount || 0,
      }
    : undefined;

  const headerBadge = revisionRequested ? (
    <StatusBadge variant="revision">{t('Revision requested')}</StatusBadge>
  ) : showStatusBadge ? (
    <ProposalStatusBadge proposal={proposal} />
  ) : undefined;

  return (
    <SenseProposalCard
      title={titleText}
      href={href}
      linkComponent={Link}
      className={className}
      selected={selected}
      headerBadge={headerBadge}
      aside={aside}
      budget={budget}
      tags={tags}
      authors={authors}
      description={description}
      metrics={metrics}
      totalVotes={totalVotes}
      totalVotesLabel={t('Total Votes')}
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
