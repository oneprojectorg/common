import {
  ProposalReviewAssignmentStatus,
  type ProposalReviewAggregates,
  type ProposalReviewAssignment,
  type ReviewAssignmentExtended,
} from '@op/common/client';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { useRef } from 'react';
import { useFocusable } from 'react-aria';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuRefreshCw,
  LuTimer,
} from 'react-icons/lu';

import type { TranslationKey } from '@/lib/i18n';
import { useTranslations } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

import { Bullet } from '../Bullet';
import {
  ProposalCard,
  ProposalCardAuthor,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
  ProposalCardPreview,
} from './ProposalCard';

type AssignmentStatus = ProposalReviewAssignment['status'];

type Reviewers = ProposalReviewAggregates['reviewers'];

interface ReviewAssignmentCardProps {
  assignment: ReviewAssignmentExtended;
  viewHref?: string;
  reviewers?: Reviewers;
}

export function ReviewAssignmentCard({
  assignment: { assignment },
  viewHref,
  reviewers,
}: ReviewAssignmentCardProps) {
  const { proposal, status } = assignment;
  const isRevised = status === 'ready_for_re_review';

  return (
    <ProposalCard proposal={proposal} className="rounded-lg">
      <ProposalCardContent>
        <ProposalCardHeader proposal={proposal} viewHref={viewHref} />
        <div className="flex flex-wrap items-center gap-2">
          <ProposalCardAuthor proposal={proposal} />
          <ProposalCardCategory proposal={proposal} />
          {isRevised && (
            <>
              <Bullet />
              <div className="flex items-center gap-1">
                <LuRefreshCw className="size-4 text-primary-orange2" />
                <span className="text-sm text-neutral-charcoal">
                  <TranslatedText text="Revised" />
                </span>
              </div>
            </>
          )}
        </div>
        <ProposalCardPreview proposal={proposal} className="line-clamp-2" />
      </ProposalCardContent>
      <div className="flex items-center justify-between gap-2">
        <ReviewStatusBadge status={status} />
        {reviewers ? <ReviewersTooltip reviewers={reviewers} /> : null}
      </div>
    </ProposalCard>
  );
}

function ReviewersTooltip({ reviewers }: { reviewers: Reviewers }) {
  const t = useTranslations();

  const completedReviewers = reviewers.filter(
    (r) => r.status === ProposalReviewAssignmentStatus.COMPLETED,
  );

  if (completedReviewers.length === 0) {
    return null;
  }

  const names = completedReviewers.map((r) => r.profile.name).join(', ');

  return (
    <TooltipTrigger>
      <FocusableSpan className="text-neutral-gray4 underline decoration-dotted underline-offset-2">
        {t('{count} Reviewed', { count: completedReviewers.length })}
      </FocusableSpan>
      <Tooltip>{names}</Tooltip>
    </TooltipTrigger>
  );
}

function FocusableSpan({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { focusableProps } = useFocusable({}, ref);
  return (
    <span {...focusableProps} ref={ref} tabIndex={0} className={className}>
      {children}
    </span>
  );
}

const statusConfig: Record<
  AssignmentStatus,
  {
    icon: typeof LuCircleDashed;
    bgClass: string;
    textClass: string;
    iconClass: string;
  }
> = {
  pending: {
    icon: LuCircleDashed,
    bgClass: 'bg-neutral-offWhite p-2',
    textClass: 'text-neutral-gray4',
    iconClass: 'text-neutral-gray4',
  },
  in_progress: {
    icon: LuTimer,
    bgClass: 'bg-primary-tealWhite p-2',
    textClass: 'text-neutral-charcoal',
    iconClass: 'text-primary-teal',
  },
  completed: {
    icon: LuCircleCheck,
    bgClass: 'bg-status-greenBg p-2',
    textClass: 'text-neutral-charcoal',
    iconClass: 'text-status-green',
  },
  awaiting_author_revision: {
    icon: LuRefreshCw,
    bgClass: 'bg-white py-2',
    textClass: 'text-neutral-charcoal',
    iconClass: 'text-primary-orange2',
  },
  ready_for_re_review: {
    icon: LuCircleAlert,
    bgClass: 'bg-functional-yellowWhite p-2',
    textClass: 'text-neutral-charcoal',
    iconClass: 'text-primary-orange2',
  },
};

const statusLabels: Record<AssignmentStatus, TranslationKey> = {
  pending: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  awaiting_author_revision: 'Revision Requested',
  ready_for_re_review: 'Needs Review',
};

function ReviewStatusBadge({ status }: { status: AssignmentStatus }) {
  const { icon: Icon, bgClass, textClass, iconClass } = statusConfig[status];

  return (
    <div className={cn('flex w-fit items-center gap-1 rounded-lg', bgClass)}>
      <Icon className={cn('size-4', iconClass)} />
      <span className={cn('text-base', textClass)}>
        <TranslatedText text={statusLabels[status]} />
      </span>
    </div>
  );
}
