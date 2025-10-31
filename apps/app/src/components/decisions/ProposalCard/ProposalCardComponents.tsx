'use client';

import { getPublicUrl } from '@/utils';
import {
  formatCurrency,
  getTextPreview,
  parseProposalData,
} from '@/utils/proposalUtils';
import { ProposalStatus, type proposalEncoder } from '@op/api/encoders';
import { match } from '@op/core';
import { Avatar } from '@op/ui/Avatar';
import { Chip } from '@op/ui/Chip';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import { Heart, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import type { HTMLAttributes, ReactNode } from 'react';
import { LuBookmark } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { Bullet } from '../../Bullet';

export type Proposal = z.infer<typeof proposalEncoder>;

export interface BaseProposalCardProps {
  proposal: Proposal;
  withLink?: boolean;
  className?: string;
}

export function ProposalCard({
  children,
  className,
  ...props
}: {
  proposal?: Proposal;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <Surface
      className={cn(
        'relative flex w-full min-w-80 flex-col justify-between gap-4 p-6',
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
  showMenu = false,
  menuComponent,
  allocated,
  className,
}: BaseProposalCardProps & {
  viewHref?: string;
  showMenu?: boolean;
  menuComponent?: ReactNode;
  allocated?: string | number | null;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex max-w-full items-start justify-between gap-2">
        <ProposalCardTitle proposal={proposal} viewHref={viewHref} />
        {showMenu && menuComponent}
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
  const { title } = parseProposalData(proposal.proposalData);

  const titleText = title || t('Untitled Proposal');
  const titleClasses =
    'max-w-full truncate text-nowrap font-serif !text-title-sm text-neutral-black';

  if (asLink && viewHref) {
    return (
      <Link
        href={viewHref}
        className={cn(
          titleClasses,
          className,
          'transition-colors hover:text-primary-teal',
        )}
      >
        {titleText}
      </Link>
    );
  }

  return <h3 className={titleClasses}>{titleText}</h3>;
}

/**
 * Budget display component
 */
export function ProposalCardBudget({
  proposal,
  allocated,
  className,
}: BaseProposalCardProps & {
  allocated?: string | number | null;
  className?: string;
}) {
  const { budget } = parseProposalData(proposal.proposalData);

  // Use allocated amount if provided, otherwise fall back to budget
  const displayAmount = allocated !== null && allocated !== undefined
    ? Number(allocated)
    : budget;

  if (!displayAmount) {
    return null;
  }

  return (
    <span
      className={cn(
        'font-serif text-title-base text-neutral-charcoal',
        className,
      )}
    >
      {formatCurrency(displayAmount)}
    </span>
  );
}

/**
 * Meta section containing author, category, and status
 */
export function ProposalCardMeta({
  proposal,
  withLink = true,
  className,
}: BaseProposalCardProps & {
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ProposalCardAuthor proposal={proposal} withLink={withLink} />
      <ProposalCardCategory proposal={proposal} />
      <ProposalCardStatus proposal={proposal} />
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
  if (!proposal.submittedBy) {
    return null;
  }

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
      {withLink ? (
        <Link
          href={`/profile/${proposal.submittedBy.slug}`}
          className="max-w-32 truncate text-nowrap text-base text-neutral-charcoal"
        >
          {proposal.submittedBy.name}
        </Link>
      ) : (
        <div className="max-w-32 truncate text-nowrap text-base text-neutral-charcoal">
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
  const { category } = parseProposalData(proposal.proposalData);

  if (!category || !proposal.submittedBy) {
    return null;
  }

  return (
    <>
      <Bullet />
      <Chip
        className={cn(
          'min-w-6 max-w-96 overflow-hidden overflow-ellipsis text-nowrap',
          className,
        )}
      >
        {category}
      </Chip>
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
  const { status } = proposal;

  return match(status, {
    [ProposalStatus.APPROVED]: (
      <>
        <span>•</span>
        <span className={cn('text-sm text-green-700', className)}>
          {t('Shortlisted')}
        </span>
      </>
    ),
    [ProposalStatus.REJECTED]: (
      <>
        <Bullet />
        <span
          className={cn('text-nowrap text-sm text-neutral-charcoal', className)}
        >
          {t('Not shortlisted')}
        </span>
      </>
    ),
    _: null,
  });
}

/**
 * Description text component
 */
export function ProposalCardDescription({
  proposal,
  className,
}: BaseProposalCardProps & {
  className?: string;
}) {
  const { description } = parseProposalData(proposal.proposalData);

  if (!description) {
    return null;
  }

  return (
    <p
      className={cn(
        'mb-4 line-clamp-3 text-base text-neutral-charcoal',
        className,
      )}
    >
      {getTextPreview(description)}
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
    <div
      className={cn(
        'flex w-full items-center justify-between gap-4 text-base text-neutral-gray4',
        className,
      )}
    >
      <span className="flex items-center gap-1 truncate">
        <Heart className="size-4" />
        {proposal.likesCount || 0} {t('Likes')}
      </span>
      <span className="flex items-center gap-1 truncate">
        <MessageCircle className="size-4" />
        {proposal.commentsCount || 0} {t('Comments')}
      </span>
      <span className="flex items-center gap-1 truncate">
        <LuBookmark className="size-4" />
        {proposal.followersCount || 0} {t('Followers')}
      </span>
    </div>
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
