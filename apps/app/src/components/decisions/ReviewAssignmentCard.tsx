'use client';

import type {
  ProposalReviewAssignment,
  ReviewAssignmentExtended,
} from '@op/common/client';
import { cn } from '@op/ui/utils';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuRefreshCw,
  LuTimer,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

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

interface ReviewAssignmentCardProps {
  assignment: ReviewAssignmentExtended;
  viewHref?: string;
}

export function ReviewAssignmentCard({
  assignment: { assignment },
  viewHref,
}: ReviewAssignmentCardProps) {
  const t = useTranslations();
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
                  {t('Revised')}
                </span>
              </div>
            </>
          )}
        </div>
        <ProposalCardPreview proposal={proposal} className="line-clamp-2" />
      </ProposalCardContent>
      <ReviewStatusBadge status={status} />
    </ProposalCard>
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

function ReviewStatusBadge({ status }: { status: AssignmentStatus }) {
  const t = useTranslations();

  const labels: Record<AssignmentStatus, string> = {
    pending: t('Not Started'),
    in_progress: t('In Progress'),
    completed: t('Completed'),
    awaiting_author_revision: t('Revision Requested'),
    ready_for_re_review: t('Needs Review'),
  };

  const { icon: Icon, bgClass, textClass, iconClass } = statusConfig[status];

  return (
    <div className={cn('flex w-fit items-center gap-1 rounded-lg', bgClass)}>
      <Icon className={cn('size-4', iconClass)} />
      <span className={cn('text-base', textClass)}>{labels[status]}</span>
    </div>
  );
}
