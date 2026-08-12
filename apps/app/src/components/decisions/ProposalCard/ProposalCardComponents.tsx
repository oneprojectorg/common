'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import {
  type ProposalTemplateSchema,
  normalizeProposalCategories,
} from '@op/common/client';
import { isNullish, match } from '@op/core';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
import { Avatar } from '@op/ui/Avatar';
import { Chip } from '@op/ui/Chip';
import { Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import type { HTMLAttributes, ReactNode } from 'react';
import { LuBookmark, LuHeart, LuMessageCircle } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { Bullet } from '../../Bullet';
import { BudgetDisplay, formatBudget } from '../BudgetDisplay';
import { useCardTranslation } from '../ProposalTranslationContext';
import { RevisionRequestChip } from '../RevisionRequestChip';
import {
  getProposalContentPreview,
  resolveProposalSystemFields,
} from '../proposalContentUtils';

export type { Proposal } from '@op/common/client';

export interface BaseProposalCardProps {
  proposal: Proposal;
  withLink?: boolean;
  className?: string;
}

export function ProposalCard({
  children,
  className,
  proposal,
  ...props
}: {
  proposal?: Proposal;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const isDraft = proposal?.status === ProposalStatus.DRAFT;

  return (
    <Surface
      variant={isDraft ? 'filled' : 'empty'}
      className={cn(
        'relative flex w-full flex-col justify-between gap-3 p-4',
        className,
      )}
      {...props}
    >
      {children}
    </Surface>
  );
}

/**
 * Content wrapper with consistent spacing
 */
export function ProposalCardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('space-y-3', className)}>{children}</div>;
}

/**
 * Header section containing title and budget
 */
export function ProposalCardHeader({
  proposal,
  viewHref,
  menu,
  allocated,
  className,
}: BaseProposalCardProps & {
  viewHref?: string;
  menu?: ReactNode;
  allocated?: string | number | null;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex max-w-full items-start justify-between gap-2">
        <ProposalCardTitle proposal={proposal} viewHref={viewHref} />
        {menu}
      </div>
      <ProposalCardBudget proposal={proposal} allocated={allocated} />
    </div>
  );
}

/**
 * Title component with optional linking
 */
export function ProposalCardTitle({
  proposal,
  viewHref,
  asLink = true,
  className,
}: BaseProposalCardProps & {
  viewHref?: string;
  asLink?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const cardTranslation = useCardTranslation(proposal.profileId);
  const { title } = resolveProposalSystemFields(proposal);

  const titleText =
    cardTranslation?.title ??
    (title || proposal.profile.name || t('Untitled Proposal'));
  const titleClasses =
    'max-w-full font-serif !text-title-sm text-neutral-black';

  if (asLink && viewHref) {
    return (
      <Link
        href={viewHref}
        className={cn(
          titleClasses,
          className,
          'transition-colors hover:text-primary-teal',
        )}
        dir="auto"
      >
        {titleText}
      </Link>
    );
  }

  return <Header3 className={titleClasses}>{titleText}</Header3>;
}

/**
 * Budget display component. When an allocated amount is present, renders it
 * as the primary value with the original requested budget as a smaller
 * secondary label ("$3,500 requested").
 */
export function ProposalCardBudget({
  proposal,
  allocated,
  className,
}: BaseProposalCardProps & {
  allocated?: string | number | null;
  className?: string;
}) {
  const t = useTranslations();
  const { budget } = resolveProposalSystemFields(proposal);

  if (!isNullish(allocated)) {
    const requestedText = formatBudget(budget);

    return (
      <div className={cn('flex flex-wrap items-end gap-2', className)}>
        <BudgetDisplay
          value={allocated}
          fallbackCurrency={budget?.currency}
          className="font-serif text-title-base text-neutral-charcoal"
        />
        {requestedText && (
          <span className="text-sm text-neutral-gray4">
            {t('{amount} requested', { amount: requestedText })}
          </span>
        )}
      </div>
    );
  }

  return (
    <BudgetDisplay
      value={budget}
      className={cn(
        'font-serif text-title-base text-neutral-charcoal',
        className,
      )}
    />
  );
}

/**
 * Meta section containing author, category, and status
 */
export function ProposalCardMeta({
  proposal,
  withLink = true,
  revisionRequested = false,
  className,
}: BaseProposalCardProps & {
  revisionRequested?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <ProposalCardAuthor proposal={proposal} withLink={withLink} />
      {revisionRequested ? (
        <>
          <Bullet />
          <RevisionRequestChip />
        </>
      ) : (
        <>
          <ProposalCardCategory proposal={proposal} />
          <ProposalCardStatus proposal={proposal} />
        </>
      )}
    </div>
  );
}

/**
 * Author avatar and name component
 */
export function ProposalCardAuthor({
  proposal,
  withLink = true,
  className,
}: BaseProposalCardProps & {
  className?: string;
}) {
  const canLinkToProfile = useCanLinkToProfile();

  if (!proposal.submittedBy) {
    return null;
  }

  const linkToProfile =
    withLink && canLinkToProfile && !proposal.submittedBy.isAnonymous;

  return (
    <>
      <Avatar
        placeholder={proposal.submittedBy.name || proposal.submittedBy.slug}
        className={cn('size-6 min-h-6 min-w-6', className)}
      >
        {proposal?.submittedBy?.avatarImage?.name ? (
          <Image
            src={getPublicUrl(proposal?.submittedBy?.avatarImage?.name) ?? ''}
            alt="User avatar"
            fill
            className="object-cover"
          />
        ) : null}
      </Avatar>
      {linkToProfile ? (
        <Link
          href={`/profile/${proposal.submittedBy.slug}`}
          className="max-w-32 truncate text-base text-nowrap text-neutral-charcoal"
        >
          {proposal.submittedBy.name}
        </Link>
      ) : (
        <div className="max-w-32 truncate text-base text-nowrap text-neutral-charcoal">
          {proposal.submittedBy.name}
        </div>
      )}
    </>
  );
}

/**
 * Category chip component
 */
export function ProposalCardCategory({
  proposal,
  className,
}: BaseProposalCardProps & {
  className?: string;
}) {
  const cardTranslation = useCardTranslation(proposal.profileId);
  const { category } = resolveProposalSystemFields(proposal);
  const displayCategories = cardTranslation?.category
    ? cardTranslation.category
    : normalizeProposalCategories(category);

  if (displayCategories.length === 0 || !proposal.submittedBy) {
    return null;
  }

  return (
    <>
      <Bullet />
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-1">
        {displayCategories.map((displayCategory) => (
          <Chip
            key={displayCategory}
            className={cn('block max-w-full min-w-0 truncate', className)}
          >
            {displayCategory}
          </Chip>
        ))}
      </div>
    </>
  );
}

/**
 * Status indicator component
 */
export function ProposalCardStatus({
  proposal,
  className,
}: BaseProposalCardProps & {
  className?: string;
}) {
  const t = useTranslations();
  const { status, visibility, isSelected, isFlagged } = proposal;

  // DRAFT wins over HIDDEN: a draft created in a hidden-by-default phase
  // should still read as "Draft" to its author, not "Hidden".
  if (status === ProposalStatus.DRAFT) {
    return (
      <>
        <Bullet />
        <span
          className={cn('text-sm text-nowrap text-neutral-charcoal', className)}
        >
          {t('Draft')}
        </span>
      </>
    );
  }

  // A flagged proposal is hidden from members pending/after a moderation
  // verdict; surface it here (above the visibility/selection states) so the
  // author sees the moderation state right in the listing.
  if (isFlagged) {
    return (
      <>
        <Bullet />
        <span
          className={cn('text-sm text-nowrap text-functional-red', className)}
        >
          {t('Flagged')}
        </span>
      </>
    );
  }

  if (visibility === Visibility.HIDDEN) {
    return (
      <>
        <Bullet />
        <span
          className={cn('text-sm text-nowrap text-primary-orange2', className)}
        >
          {t('Hidden')}
        </span>
      </>
    );
  }

  // "Selected" is driven by results selection, not the editable `status`.
  if (isSelected) {
    return (
      <>
        <Bullet />
        <span className={cn('text-sm text-green-700', className)}>
          {t('Selected')}
        </span>
      </>
    );
  }

  return match(status, {
    [ProposalStatus.APPROVED]: (
      <>
        <Bullet />
        <span className={cn('text-sm text-green-700', className)}>
          {t('Shortlisted')}
        </span>
      </>
    ),
    [ProposalStatus.REJECTED]: (
      <>
        <Bullet />
        <span
          className={cn('text-sm text-nowrap text-neutral-charcoal', className)}
        >
          {t('Not shortlisted')}
        </span>
      </>
    ),
    _: null,
  });
}

/**
 * Content preview/excerpt component
 */
export function ProposalCardPreview({
  proposal,
  className,
}: BaseProposalCardProps & {
  className?: string;
}) {
  const cardTranslation = useCardTranslation(proposal.profileId);
  const translatedPreview = cardTranslation?.preview;

  // List payloads carry a server-computed `previewText`; other payloads
  // (e.g. the single-proposal view) still ship the full documentContent,
  // so fall back to the client-side fragment walk for those.
  const previewText =
    translatedPreview === undefined
      ? (proposal.previewText ??
        getProposalContentPreview(
          proposal.documentContent,
          (proposal.proposalTemplate as ProposalTemplateSchema) ?? undefined,
        ))
      : undefined;

  const displayText = translatedPreview ?? previewText;

  if (displayText === null) {
    return null;
  }

  if (!displayText) {
    return null;
  }

  return (
    <p
      className={cn('line-clamp-3 text-base text-neutral-charcoal', className)}
      dir="auto"
    >
      {displayText}
    </p>
  );
}

/**
 * Engagement metrics component (likes, comments, followers)
 */
export function ProposalCardMetrics({
  proposal,
  className,
}: BaseProposalCardProps & {
  className?: string;
}) {
  const t = useTranslations();

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex w-full flex-wrap items-center gap-4 text-base text-neutral-gray4',
          className,
        )}
      >
        <ProposalCardMetric
          icon={<LuHeart className="size-4 shrink-0" />}
          count={proposal.likesCount || 0}
          label={t('Likes')}
        />
        <ProposalCardMetric
          icon={<LuMessageCircle className="size-4 shrink-0" />}
          count={proposal.commentsCount || 0}
          label={t('Comments')}
        />
        <ProposalCardMetric
          icon={<LuBookmark className="size-4 shrink-0" />}
          count={proposal.followersCount || 0}
          label={t('Followers')}
        />
      </div>
    </TooltipProvider>
  );
}

// The label lives in a tooltip — the chip shows only the icon + count, since
// room is tight on narrow cards. The trigger renders as a focusable span so the
// tooltip is keyboard-reachable; aria-label keeps the bare count meaningful to
// screen readers.
function ProposalCardMetric({
  icon,
  count,
  label,
}: {
  icon: ReactNode;
  count: number;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`${count} ${label}`}
            className="flex shrink-0 items-center gap-1"
          />
        }
      >
        {icon}
        {count}
      </TooltipTrigger>
      <TooltipContent className="text-sm">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Footer container for actions or custom content
 */
export function ProposalCardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col justify-between gap-4', className)}>
      {children}
    </div>
  );
}
