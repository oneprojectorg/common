'use client';

import { getPublicUrl } from '@/utils';
import { formatCurrency } from '@/utils/formatting';
import {
  ProposalStatus,
  Visibility,
  type proposalEncoder,
} from '@op/api/encoders';
import { parseProposalData } from '@op/common/client';
import { isNullish, match } from '@op/core';
import { Avatar } from '@op/ui/Avatar';
import { Chip } from '@op/ui/Chip';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import { Heart, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import type { HTMLAttributes, ReactNode } from 'react';
import { LuBookmark } from 'react-icons/lu';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { Bullet } from '../../Bullet';
import { DocumentNotAvailable } from '../DocumentNotAvailable';
import { getProposalContentPreview } from '../proposalContentUtils';

export type Proposal = z.infer<typeof proposalEncoder>;

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
  if (!isNullish(allocated)) {
    return (
      <span
        className={cn(
          'font-serif text-title-base text-neutral-charcoal',
          className,
        )}
      >
        {formatCurrency(
          Number(allocated),
          undefined,
          budget?.currency ?? 'USD',
        )}
      </span>
    );
  }

  if (!budget) {
    return null;
  }

  return (
    <span
      className={cn(
        'font-serif text-title-base text-neutral-charcoal',
        className,
      )}
    >
      {formatCurrency(budget.amount, undefined, budget.currency)}
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
  const { category } = parseProposalData(proposal.proposalData);

  if (!category || !proposal.submittedBy) {
    return null;
  }

  return (
    <>
      <Bullet />
      <Chip
        className={cn(
          'max-w-96 min-w-6 overflow-hidden text-nowrap overflow-ellipsis',
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
  const { status, visibility } = proposal;

  // Show hidden status first if proposal is hidden
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

  return match(status, {
    [ProposalStatus.DRAFT]: (
      <>
        <Bullet />
        <span
          className={cn('text-sm text-nowrap text-neutral-charcoal', className)}
        >
          {t('Draft')}
        </span>
      </>
    ),
    [ProposalStatus.APPROVED]: (
      <>
        <Bullet />
        <span className={cn('text-sm text-green-700', className)}>
          {t('Shortlisted')}
        </span>
      </>
    ),
    [ProposalStatus.SELECTED]: (
      <>
        <Bullet />
        <span className={cn('text-sm text-green-700', className)}>
          {t('Funded')}
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
  const previewText = getProposalContentPreview(proposal.documentContent);

  if (previewText === null) {
    return <DocumentNotAvailable className="py-4" />;
  }

  if (!previewText) {
    return null;
  }

  return (
    <p
      className={cn(
        'mb-4 line-clamp-3 text-base text-neutral-charcoal',
        className,
      )}
    >
      {previewText}
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
